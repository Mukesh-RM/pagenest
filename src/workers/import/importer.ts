import type { BookFormat, BookKind } from '@/app/contracts';
import type { BookRepository} from '@/data/books';
import { BookRepositoryError, type NewChapter, type NewTrack } from '@/data/books';
import { computeFingerprint } from '@/data/fingerprint';
import { naturalCompare, readRange } from './bytes';
import { folderOf, lastFolderName, titleFromFileName } from './names';
import { parseEpub } from './parsers/epub';
import type { ImportItem, ItemOutcome } from './protocol';
import { imageType, sniffFile } from './sniff';
import { UNSUPPORTED_MESSAGES, type ParsedMeta, type UnsupportedReason } from './types';

/**
 * The import pipeline, free of any worker plumbing so it can be tested in Node:
 * sniff the content, fingerprint, read metadata and cover, then hand the book to `BookRepository.add`. Runs inside `import.worker.ts`; the main thread only draws.
 */

export interface ImportDeps {
  /** All storage goes through the data layer's repository (atomic add, duplicate detection, covers). */
  readonly books: BookRepository;
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
  index: number;
  name: string;
  result: Awaited<ReturnType<typeof sniffFile>>;
}

interface Dup {
  id: string;
  title: string;
  kind: BookKind;
  format: BookFormat;
}

const unsupported = (name: string, index: number, reason: UnsupportedReason): ItemOutcome => ({
  status: 'unsupported',
  name,
  index,
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

/** Map a thrown storage error to a plain-words reason. */
export function reasonForError(error: unknown): UnsupportedReason {
  if (error instanceof BookRepositoryError) return error.code === 'storage-full' ? 'storage-full' : 'failed';
  const name = error instanceof Error ? error.name : '';
  if (name === 'QuotaExceededError' || (error instanceof Error && /quota|no space|full/i.test(error.message))) return 'storage-full';
  if (name === 'SecurityError' || name === 'NotAllowedError' || (error instanceof Error && error.name === 'FileStoreError' && /unsupported/.test(String((error as { code?: string }).code)))) return 'storage-unavailable';
  return 'failed';
}

function firstFormatOf(tracks: readonly Sniffed[]): BookFormat {
  return (tracks[0]?.result.ok ? tracks[0].result.format : 'mp3') as BookFormat;
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

  /** Import every item. Outcomes arrive through `run.onOutcome` in completion order. */
  async importAll(items: readonly ImportItem[], run: ImportRun): Promise<void> {
    const sniffed: Sniffed[] = [];
    await mapPool(items, 4, async (item, index) => {
      sniffed.push({ item, index, name: item.file.name, result: await sniffFile(item.file) });
    }, run.isCancelled);
    // Keep the order the person chose.
    sniffed.sort((a, b) => a.index - b.index);

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
        if (unit.kind === 'skip') return emit({ status: 'skipped', name: unit.s.name, index: unit.s.index });
        if (unit.kind === 'single') return emit(await this.importSingle(unit.s));
        return emit(await this.importAlbum(unit.folder, unit.tracks, unit.sidecars));
      },
      run.isCancelled,
    );
  }

  // -------------------------------------------------------------------------

  private async findDuplicate(fingerprint: string): Promise<Dup | undefined> {
    const row = await this.deps.books.findByFingerprint(fingerprint);
    return row ? { id: row.id, title: row.title, kind: row.kind, format: row.format } : undefined;
  }

  /** A cover blob at card size (or the original bytes when it cannot be shrunk). */
  private async coverBlob(bytes: Uint8Array | undefined): Promise<Blob | undefined> {
    if (!bytes) return undefined;
    const thumb = (await this.deps.makeThumbnail(bytes).catch(() => undefined)) ?? bytes;
    return new Blob([thumb as BlobPart]);
  }

  private async importSingle(s: Sniffed): Promise<ItemOutcome> {
    const { file } = s.item;
    if (!s.result.ok) return unsupported(s.name, s.index, s.result.reason);
    const { kind, format } = s.result;
    let fingerprint = '';
    let claimed = false;
    try {
      fingerprint = await computeFingerprint(file);
      const dup = await this.claim(fingerprint, kind, format);
      if (dup) return { status: 'duplicate', name: s.name, index: s.index, title: dup.title, bookId: dup.id, kind: dup.kind, format: dup.format };
      claimed = true;

      const meta = await this.readMeta(file, format);
      const title = meta.title ?? titleFromFileName(s.name);
      const chapters: NewChapter[] = (meta.chapters ?? []).map((c, index) => ({ index, title: c.title, startSec: c.startSec }));
      const files =
        kind === 'audio'
          ? { tracks: [{ file, fileName: `track-0.${format}`, title, durationSec: meta.durationSec ?? 0, startOffsetSec: 0 } satisfies NewTrack] }
          : { file, fileName: `book.${format}` };
      const cover = await this.coverBlob(meta.cover?.bytes);
      const result = await this.deps.books.add({
        fingerprint,
        kind,
        format,
        title,
        ...(meta.author ? { author: meta.author } : {}),
        ...(meta.narrator ? { narrator: meta.narrator } : {}),
        ...(meta.series ? { series: meta.series } : {}),
        ...(meta.language ? { language: meta.language } : {}),
        ...(meta.durationSec ? { durationSec: meta.durationSec } : {}),
        ...(meta.pages ? { pages: meta.pages } : {}),
        addedAt: this.now(),
        ...files,
        ...(cover ? { cover } : {}),
        ...(chapters.length > 0 ? { chapters } : {}),
      });
      return result.status === 'added'
        ? { status: 'added', name: s.name, index: s.index, book: result.book }
        : { status: 'duplicate', name: s.name, index: s.index, title: result.existing.title, bookId: result.existing.id, kind: result.existing.kind, format: result.existing.format };
    } catch (error) {
      return unsupported(s.name, s.index, reasonForError(error));
    } finally {
      if (claimed) this.inFlight.delete(fingerprint);
    }
  }

  private async importAlbum(folder: string, tracksIn: Sniffed[], sidecars: Sniffed[]): Promise<ItemOutcome> {
    const tracks = [...tracksIn].sort((a, b) => naturalCompare(a.item.relPath ?? a.name, b.item.relPath ?? b.name));
    const name = lastFolderName(folder);
    const index = tracks[0]?.index ?? 0;
    let fingerprint = '';
    let claimed = false;
    try {
      const prints: string[] = [];
      for (const t of tracks) prints.push(await computeFingerprint(t.item.file));
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(prints.join('|')));
      fingerprint = `album${tracks.length}-${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')}`;
      const dup = await this.claim(fingerprint, 'audio', firstFormatOf(tracks));
      if (dup) return { status: 'duplicate', name, index, title: dup.title, bookId: dup.id, kind: dup.kind, format: dup.format };
      claimed = true;

      const trackRows: NewTrack[] = [];
      const chapters: NewChapter[] = [];
      let offset = 0;
      let first: ParsedMeta = {};
      let coverBytes: Uint8Array | undefined;
      for (const [index, t] of tracks.entries()) {
        const format = (t.result.ok ? t.result.format : 'mp3') as BookFormat;
        const meta = await this.readMeta(t.item.file, format);
        if (index === 0) first = meta;
        coverBytes ??= meta.cover?.bytes;
        const title = meta.trackTitle ?? titleFromFileName(t.name);
        const duration = meta.durationSec ?? 0;
        trackRows.push({ file: t.item.file, fileName: `track.${format}`, title, durationSec: duration, startOffsetSec: offset });
        chapters.push({ index, title, locator: { kind: 'audio', trackIndex: index, positionSec: 0 } });
        offset += duration;
      }
      coverBytes ??= await this.pickSidecarCover(sidecars);
      const cover = await this.coverBlob(coverBytes);
      const firstFormat = (tracks[0]?.result.ok ? tracks[0].result.format : 'mp3') as BookFormat;
      const result = await this.deps.books.add({
        fingerprint,
        kind: 'audio',
        format: firstFormat,
        title: first.title ?? titleFromFileName(name),
        ...(first.author ? { author: first.author } : {}),
        ...(first.narrator ? { narrator: first.narrator } : {}),
        ...(first.series ? { series: first.series } : {}),
        ...(first.language ? { language: first.language } : {}),
        ...(offset > 0 ? { durationSec: offset } : {}),
        addedAt: this.now(),
        tracks: trackRows,
        ...(cover ? { cover } : {}),
        chapters,
      });
      return result.status === 'added'
        ? { status: 'added', name, index, book: result.book }
        : { status: 'duplicate', name, index, title: result.existing.title, bookId: result.existing.id, kind: result.existing.kind, format: result.existing.format };
    } catch (error) {
      return unsupported(name, index, reasonForError(error));
    } finally {
      if (claimed) this.inFlight.delete(fingerprint);
    }
  }

  /** Reserve a fingerprint. Returns the existing book when it is already there or being added right now. */
  private async claim(fingerprint: string, kind: BookKind, format: BookFormat): Promise<Dup | undefined> {
    if (this.inFlight.has(fingerprint)) {
      // Another copy of the same file is being added at this moment: wait for it, then report it.
      for (let i = 0; i < 600 && this.inFlight.has(fingerprint); i += 1) await new Promise((r) => setTimeout(r, 10));
      return (await this.findDuplicate(fingerprint)) ?? { id: '', title: 'this book', kind, format };
    }
    this.inFlight.add(fingerprint); // reserve first: the check below awaits, and a twin must not slip in
    const existing = await this.findDuplicate(fingerprint);
    if (existing) {
      this.inFlight.delete(fingerprint);
      return existing;
    }
    return undefined;
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
          return await (await import('./parsers/docx')).parseDocx(file);
        case 'cbz':
          return await (await import('./parsers/cbz')).parseCbz(file);
        case 'mobi':
        case 'azw3':
          return await (await import('./parsers/mobi')).parseMobi(file);
        case 'fb2':
          return await (await import('./parsers/fb2')).parseFb2(file);
        case 'pdf':
          return await (await import('./parsers/pdf')).parsePdf(file);
        case 'html':
          return await (await import('./parsers/html')).parseHtml(file);
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
            const chapters = await (await import('./parsers/mp4chapters')).parseMp4Chapters(file).catch(() => []);
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
