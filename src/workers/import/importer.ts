import type { BookFormat } from '@/app/contracts';
import { computeFingerprint } from '@/data/fingerprint';
import type { PageNestDB } from '@/data/db';
import { newId } from '@/data/db';
import type { ChapterRecord, TrackRecord } from '@/data/schema';
import { FilePaths, type FileStore } from '@/data/opfs';
import { naturalCompare, readRange } from './bytes';
import { folderOf, lastFolderName, titleFromFileName } from './names';
import { parseCbz } from './parsers/cbz';
import { parseDocx } from './parsers/docx';
import { parseEpub } from './parsers/epub';
import { parseFb2 } from './parsers/fb2';
import { parseHtml } from './parsers/html';
import { parseMobi } from './parsers/mobi';
import { parseMp4Chapters } from './parsers/mp4chapters';
import { parsePdf } from './parsers/pdf';
import type { ImportItem, ItemOutcome, StoredBook } from './protocol';
import { imageType, sniffFile } from './sniff';
import { UNSUPPORTED_MESSAGES, type ParsedMeta, type UnsupportedReason } from './types';

/**
 * The import pipeline, free of any worker plumbing so it can be tested in Node:
 * sniff the content, fingerprint, read metadata and cover, copy the bytes into the file store,
 * and write the book rows. Runs inside `import.worker.ts`; the main thread only draws.
 */

export interface ImportDeps {
  readonly db: PageNestDB;
  readonly files: FileStore;
  /** Copy a blob into the file store without loading it into memory. Defaults to `files.write`. */
  readonly writeBlob?: (path: string, blob: Blob) => Promise<void>;
  /** Audio tags (music-metadata). May reject; the file is still imported. */
  readonly parseAudio: (blob: Blob) => Promise<ParsedMeta>;
  /** Shrink a cover to card size. Return `undefined` to keep the original bytes. */
  readonly makeThumbnail: (bytes: Uint8Array) => Promise<Uint8Array | undefined>;
  readonly now?: () => number;
}

export interface ImportRun {
  /** Called once per file or folder-book as soon as it is done. */
  onOutcome(outcome: ItemOutcome, done: number, total: number): void;
  onStart?(total: number): void;
  isCancelled?(): boolean;
  concurrency?: number;
}

interface Sniffed {
  item: ImportItem;
  name: string;
  result: Awaited<ReturnType<typeof sniffFile>>;
}

const unsupported = (name: string, reason: UnsupportedReason): ItemOutcome => ({
  status: 'unsupported',
  name,
  reason,
  message: UNSUPPORTED_MESSAGES[reason],
});

async function mapPool<T>(items: readonly T[], size: number, work: (item: T, index: number) => Promise<void>, stop?: () => boolean): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(size, items.length)) }, async () => {
    for (;;) {
      if (stop?.()) return;
      const i = next;
      next += 1;
      if (i >= items.length) return;
      await work(items[i] as T, i);
    }
  });
  await Promise.all(runners);
}

/** Map a thrown storage error to plain words. */
export function reasonForError(error: unknown): UnsupportedReason {
  const name = error instanceof Error ? error.name : '';
  if (name === 'QuotaExceededError' || (error instanceof Error && /quota|no space|full/i.test(error.message))) return 'storage-full';
  if (name === 'SecurityError' || name === 'NotAllowedError' || (error instanceof Error && error.name === 'FileStoreError' && /unsupported/.test(String((error as { code?: string }).code)))) return 'storage-unavailable';
  return 'failed';
}

export class Importer {
  private readonly inFlight = new Set<string>();
  private lastAddedAt = 0;

  constructor(private readonly deps: ImportDeps) {}

  private now(): number {
    const t = (this.deps.now ?? Date.now)();
    this.lastAddedAt = Math.max(t, this.lastAddedAt + 1);
    return this.lastAddedAt;
  }

  private write(path: string, blob: Blob): Promise<void> {
    return (this.deps.writeBlob ?? ((p, b) => this.deps.files.write(p, b)))(path, blob);
  }

  /** Import every item. Outcomes arrive through `run.onOutcome` in completion order. */
  async importAll(items: readonly ImportItem[], run: ImportRun): Promise<void> {
    const sniffed: Sniffed[] = [];
    await mapPool(items, 4, async (item) => {
      sniffed.push({ item, name: item.file.name, result: await sniffFile(item.file) });
    }, run.isCancelled);
    // Keep the order the person chose.
    sniffed.sort((a, b) => items.indexOf(a.item) - items.indexOf(b.item));

    // A folder with two or more audio files is one audiobook.
    const byFolder = new Map<string, Sniffed[]>();
    for (const s of sniffed) {
      const folder = folderOf(s.item.relPath);
      if (folder === '') continue;
      const list = byFolder.get(folder) ?? [];
      list.push(s);
      byFolder.set(folder, list);
    }
    type Unit = { kind: 'single'; s: Sniffed } | { kind: 'album'; folder: string; tracks: Sniffed[]; sidecars: Sniffed[] } | { kind: 'skip'; s: Sniffed };
    const albumFolders = new Set<string>();
    const units: Unit[] = [];
    for (const [folder, list] of byFolder) {
      const tracks = list.filter((s) => s.result.ok && s.result.kind === 'audio');
      if (tracks.length >= 2) albumFolders.add(folder);
    }
    const emittedAlbums = new Set<string>();
    for (const s of sniffed) {
      const folder = folderOf(s.item.relPath);
      if (albumFolders.has(folder)) {
        const isTrack = s.result.ok && s.result.kind === 'audio';
        const isSidecar = !s.result.ok && s.result.reason === 'unsupported-type';
        if (isTrack) {
          if (!emittedAlbums.has(folder)) {
            emittedAlbums.add(folder);
            const list = byFolder.get(folder) ?? [];
            units.push({ kind: 'album', folder, tracks: list.filter((x) => x.result.ok && x.result.kind === 'audio'), sidecars: list.filter((x) => !x.result.ok && x.result.reason === 'unsupported-type') });
          }
          continue;
        }
        if (isSidecar) {
          units.push({ kind: 'skip', s });
          continue;
        }
      }
      units.push({ kind: 'single', s });
    }

    const total = units.length;
    run.onStart?.(total);
    let done = 0;
    const emit = (outcome: ItemOutcome): void => {
      done += 1;
      run.onOutcome(outcome, done, total);
    };
    await mapPool(
      units,
      run.concurrency ?? 3,
      async (unit) => {
        if (unit.kind === 'skip') return emit({ status: 'skipped', name: unit.s.name });
        if (unit.kind === 'single') return emit(await this.importSingle(unit.s));
        return emit(await this.importAlbum(unit.folder, unit.tracks, unit.sidecars));
      },
      run.isCancelled,
    );
  }

  // -------------------------------------------------------------------------

  private async findDuplicate(fingerprint: string): Promise<{ id: string; title: string } | undefined> {
    const row = await this.deps.db.books.where('fingerprint').equals(fingerprint).first();
    return row ? { id: row.id, title: row.title } : undefined;
  }

  private async importSingle(s: Sniffed): Promise<ItemOutcome> {
    const { file } = s.item;
    if (!s.result.ok) return unsupported(s.name, s.result.reason);
    const { kind, format } = s.result;
    const id = newId();
    let fingerprint = '';
    let claimed = false;
    try {
      fingerprint = await computeFingerprint(file);
      const dup = await this.claim(fingerprint);
      if (dup) return { status: 'duplicate', name: s.name, title: dup.title, bookId: dup.id };
      claimed = true;

      const meta = await this.readMeta(file, format);
      const title = meta.title ?? titleFromFileName(s.name);
      const fileRef = FilePaths.book(id, `book.${format}`);
      await this.write(fileRef, file);
      let coverRef: string | undefined;
      if (meta.cover) coverRef = await this.storeCover(id, meta.cover.bytes);

      const book: StoredBook = {
        id,
        fingerprint,
        kind,
        format,
        title,
        ...(meta.author ? { author: meta.author } : {}),
        ...(meta.narrator ? { narrator: meta.narrator } : {}),
        ...(meta.series ? { series: meta.series } : {}),
        ...(meta.language ? { language: meta.language } : {}),
        ...(coverRef ? { coverRef } : {}),
        fileRef,
        ...(meta.durationSec ? { durationSec: meta.durationSec } : {}),
        ...(meta.pages ? { pages: meta.pages } : {}),
        addedAt: this.now(),
        favorite: false,
        finished: false,
        sizeBytes: file.size,
      };
      const tracks: TrackRecord[] =
        kind === 'audio' ? [{ bookId: id, index: 0, fileRef, title, durationSec: meta.durationSec ?? 0, startOffsetSec: 0 }] : [];
      const chapters: ChapterRecord[] = (meta.chapters ?? []).map((c, index) => ({ bookId: id, index, title: c.title, startSec: c.startSec }));
      return await this.commit(book, tracks, chapters, s.name, id);
    } catch (error) {
      await this.cleanup(id);
      return unsupported(s.name, reasonForError(error));
    } finally {
      if (claimed) this.inFlight.delete(fingerprint);
    }
  }

  private async importAlbum(folder: string, tracksIn: Sniffed[], sidecars: Sniffed[]): Promise<ItemOutcome> {
    const tracks = [...tracksIn].sort((a, b) => naturalCompare(a.item.relPath ?? a.name, b.item.relPath ?? b.name));
    const name = lastFolderName(folder);
    const id = newId();
    let fingerprint = '';
    let claimed = false;
    try {
      const prints: string[] = [];
      for (const t of tracks) prints.push(await computeFingerprint(t.item.file));
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(prints.join('|')));
      fingerprint = `album${tracks.length}-${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')}`;
      const dup = await this.claim(fingerprint);
      if (dup) return { status: 'duplicate', name, title: dup.title, bookId: dup.id };
      claimed = true;

      const trackRows: TrackRecord[] = [];
      const chapters: ChapterRecord[] = [];
      let offset = 0;
      let first: ParsedMeta = {};
      let coverBytes: Uint8Array | undefined;
      let size = 0;
      for (const [index, t] of tracks.entries()) {
        const format = (t.result.ok ? t.result.format : 'mp3') as BookFormat;
        const meta = await this.readMeta(t.item.file, format);
        if (index === 0) first = meta;
        coverBytes ??= meta.cover?.bytes;
        const ref = FilePaths.track(id, index, `track.${format}`);
        await this.write(ref, t.item.file);
        size += t.item.file.size;
        const title = meta.trackTitle ?? titleFromFileName(t.name);
        const duration = meta.durationSec ?? 0;
        trackRows.push({ bookId: id, index, fileRef: ref, title, durationSec: duration, startOffsetSec: offset });
        chapters.push({ bookId: id, index, title, locator: { kind: 'audio', trackIndex: index, positionSec: 0 } });
        offset += duration;
      }
      coverBytes ??= await this.pickSidecarCover(sidecars);
      let coverRef: string | undefined;
      if (coverBytes) coverRef = await this.storeCover(id, coverBytes);
      const firstFormat = (tracks[0]?.result.ok ? tracks[0].result.format : 'mp3') as BookFormat;
      const book: StoredBook = {
        id,
        fingerprint,
        kind: 'audio',
        format: firstFormat,
        title: first.title ?? titleFromFileName(name),
        ...(first.author ? { author: first.author } : {}),
        ...(first.narrator ? { narrator: first.narrator } : {}),
        ...(first.series ? { series: first.series } : {}),
        ...(first.language ? { language: first.language } : {}),
        ...(coverRef ? { coverRef } : {}),
        ...(offset > 0 ? { durationSec: offset } : {}),
        addedAt: this.now(),
        favorite: false,
        finished: false,
        sizeBytes: size,
      };
      return await this.commit(book, trackRows, chapters, name, id);
    } catch (error) {
      await this.cleanup(id);
      return unsupported(name, reasonForError(error));
    } finally {
      if (claimed) this.inFlight.delete(fingerprint);
    }
  }

  /** Reserve a fingerprint. Returns the existing book when it is already there or being added right now. */
  private async claim(fingerprint: string): Promise<{ id: string; title: string } | undefined> {
    if (this.inFlight.has(fingerprint)) {
      // Another copy of the same file is being added at this moment: wait for it, then report it.
      for (let i = 0; i < 600 && this.inFlight.has(fingerprint); i += 1) await new Promise((r) => setTimeout(r, 10));
      return (await this.findDuplicate(fingerprint)) ?? { id: '', title: 'this book' };
    }
    this.inFlight.add(fingerprint); // reserve first: the check below awaits, and a twin must not slip in
    const existing = await this.findDuplicate(fingerprint);
    if (existing) {
      this.inFlight.delete(fingerprint);
      return existing;
    }
    return undefined;
  }

  private async commit(book: StoredBook, tracks: TrackRecord[], chapters: ChapterRecord[], name: string, id: string): Promise<ItemOutcome> {
    const { db } = this.deps;
    try {
      await db.transaction('rw', db.books, db.tracks, db.chapters, async () => {
        await db.books.add(book);
        if (tracks.length > 0) await db.tracks.bulkAdd(tracks);
        if (chapters.length > 0) await db.chapters.bulkAdd(chapters);
      });
    } catch (error) {
      await this.cleanup(id);
      if (error instanceof Error && error.name === 'ConstraintError') {
        const dup = await this.findDuplicate(book.fingerprint);
        return { status: 'duplicate', name, title: dup?.title ?? book.title, bookId: dup?.id ?? '' };
      }
      throw error;
    }
    return { status: 'added', name, book };
  }

  private async cleanup(id: string): Promise<void> {
    await this.deps.files.remove(`books/${id}`).catch(() => undefined);
    await this.deps.files.remove(FilePaths.cover(id)).catch(() => undefined);
  }

  private async storeCover(id: string, bytes: Uint8Array): Promise<string | undefined> {
    try {
      const thumb = (await this.deps.makeThumbnail(bytes).catch(() => undefined)) ?? bytes;
      const ref = FilePaths.cover(id);
      await this.write(ref, new Blob([thumb as BlobPart]));
      return ref;
    } catch {
      return undefined; // a missing cover is fine: the card shows a generated title card
    }
  }

  private async pickSidecarCover(sidecars: Sniffed[]): Promise<Uint8Array | undefined> {
    const images = sidecars.filter((s) => s.item.file.size <= 12 * 1024 * 1024);
    const preferred = images.find((s) => /cover|folder|front|album/i.test(s.name)) ?? images[0];
    if (!preferred) return undefined;
    const bytes = await readRange(preferred.item.file, 0, preferred.item.file.size);
    return imageType(bytes) ? bytes : undefined;
  }

  /** Read whatever metadata the format has. Never throws: a damaged file still imports. */
  async readMeta(file: Blob, format: BookFormat): Promise<ParsedMeta> {
    try {
      switch (format) {
        case 'epub':
          return await parseEpub(file);
        case 'docx':
          return await parseDocx(file);
        case 'cbz':
          return await parseCbz(file);
        case 'mobi':
        case 'azw3':
          return await parseMobi(file);
        case 'fb2':
          return await parseFb2(file);
        case 'pdf':
          return await parsePdf(file);
        case 'html':
          return await parseHtml(file);
        case 'mp3':
        case 'm4a':
        case 'm4b':
        case 'aac':
        case 'ogg':
        case 'opus':
        case 'flac':
        case 'wav': {
          const meta = await this.deps.parseAudio(file).catch((): ParsedMeta => ({}));
          if ((format === 'm4b' || format === 'm4a') && !meta.chapters?.length) {
            const chapters = await parseMp4Chapters(file).catch(() => []);
            if (chapters.length > 0) meta.chapters = chapters;
          }
          return meta;
        }
        default:
          return {};
      }
    } catch {
      return {};
    }
  }
}
