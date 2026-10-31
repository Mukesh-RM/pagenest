import type { BookRepository, NewChapter, NewTrack } from '@/data/books';
import type { CollectionRepository } from '@/data/collections';
import type { PageNestDB } from '@/data/db';
import type { FileStore } from '@/data/opfs';
import type { BookRecord, ChapterRecord, CollectionBookRecord, CollectionRecord, TrackRecord } from '@/data/schema';
import { readRange } from './bytes';
import type { RestoreSummary, StorageBreakdown } from './protocol';
import { crc32Blob, readZipEntries, readZipEntry, storedEntryBlob, ZipBuilder, ZipError } from './zip';

/**
 * Backup and restore (blueprint sections 2 and 6): the whole library, progress, notes, shelves,
 * settings and voices in ONE zip file the person saves themselves. The zip stores files without
 * compression and is assembled from file references, so a library of many gigabytes is never
 * held in memory. No network code: the file goes to the person's disk or comes from it.
 */

export const BACKUP_FORMAT = 'pagenest-backup';
export const BACKUP_VERSION = 1;
export const MANIFEST_NAME = 'pagenest-backup.json';

/** Stores that are saved. `renders` (narrated chapters) can be made again, so they are left out. */
const DATA_STORES = ['books', 'tracks', 'chapters', 'progress', 'bookmarks', 'highlights', 'collections', 'collectionBooks', 'sessions', 'voices', 'settings'] as const;
type DataStore = (typeof DATA_STORES)[number];

/** Folders of the file store that are saved. */
const FILE_ROOTS = ['books', 'covers', 'voices'] as const;

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

interface Manifest {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: number;
  counts: Record<string, number>;
  files: number;
}

type Progress = (stage: string, done: number, total: number) => void;

async function walk(files: FileStore, dir: string, out: string[]): Promise<void> {
  for (const entry of await files.list(dir)) {
    const path = dir === '' ? entry.name : `${dir}/${entry.name}`;
    if (entry.kind === 'directory') await walk(files, path, out);
    else out.push(path);
  }
}

/** Every file that belongs in a backup. */
export async function listBackupFiles(files: FileStore): Promise<string[]> {
  const out: string[] = [];
  for (const root of FILE_ROOTS) await walk(files, root, out);
  return out.sort();
}

export function backupFileName(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `InkQuiet backup ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.zip`;
}

/** Build the backup zip. */
export async function createBackup(db: PageNestDB, files: FileStore, progress: Progress = () => undefined, now: () => Date = () => new Date(), zip64Threshold?: number): Promise<Blob> {
  const zip = new ZipBuilder(now(), zip64Threshold);
  const counts: Record<string, number> = {};
  const encoder = new TextEncoder();
  progress('Saving your library', 0, 1);
  for (const store of DATA_STORES) {
    const rows = await db.table(store).toArray();
    counts[store] = rows.length;
    zip.addBytes(`data/${store}.json`, encoder.encode(JSON.stringify(rows)));
  }
  const paths = await listBackupFiles(files);
  const sizes: number[] = [];
  let total = 0;
  for (const p of paths) {
    const size = await files.size(p);
    sizes.push(size);
    total += size;
  }
  let done = 0;
  for (const [i, path] of paths.entries()) {
    const file = await files.open(path);
    const base = done;
    const crc = await crc32Blob(file, (bytes) => progress('Packing files', base + bytes, total));
    zip.addBlob(`files/${path}`, file, crc);
    done += sizes[i] as number;
    progress('Packing files', done, total);
  }
  const manifest: Manifest = { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: now().getTime(), counts, files: paths.length };
  zip.addBytes(MANIFEST_NAME, encoder.encode(JSON.stringify(manifest, null, 2)));
  return zip.finish();
}

const CHUNK = 400;

async function putAll(db: PageNestDB, store: DataStore, rows: unknown[]): Promise<void> {
  const table = db.table(store);
  for (let i = 0; i < rows.length; i += CHUNK) {
    await table.bulkPut(rows.slice(i, i + CHUNK));
    await new Promise((r) => setTimeout(r, 0));
  }
}

/** What `restoreBackup` writes through: books and shelves go through the data layer's repositories. */
export interface RestoreDeps {
  db: PageNestDB;
  files: FileStore;
  books: BookRepository;
  collections: CollectionRepository;
}

const DAMAGED = 'This backup is damaged. Try another copy.';
const baseName = (ref: string): string => ref.slice(ref.lastIndexOf('/') + 1);

/**
 * Restore a backup into the library. Safe to run on a library that already has books: books with
 * the same fingerprint are kept as they are (their progress is merged), everything else is added
 * through `BookRepository.add` (one book at a time, all or nothing), so ids are new and every other
 * record is re-pointed to them.
 */
export async function restoreBackup(source: Blob, deps: RestoreDeps, progress: Progress = () => undefined): Promise<RestoreSummary> {
  const { db, files, books, collections } = deps;
  let entries;
  try {
    entries = await readZipEntries(source);
  } catch (error) {
    if (error instanceof ZipError) throw new BackupError('This file does not look like a InkQuiet backup, or it is damaged.');
    throw error;
  }
  const manifestEntry = entries.find((e) => e.name === MANIFEST_NAME);
  if (!manifestEntry) throw new BackupError('This file is not a InkQuiet backup.');
  let manifest: Manifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(await readZipEntry(source, manifestEntry, 1_000_000))) as Manifest;
  } catch {
    throw new BackupError(DAMAGED);
  }
  if (manifest.format !== BACKUP_FORMAT) throw new BackupError('This file is not a InkQuiet backup.');
  if (manifest.version > BACKUP_VERSION) throw new BackupError('This backup was made by a newer InkQuiet. Update the app, then try again.');

  const readRows = async (store: DataStore): Promise<unknown[]> => {
    const entry = entries.find((e) => e.name === `data/${store}.json`);
    if (!entry) return [];
    try {
      const parsed: unknown = JSON.parse(new TextDecoder().decode(await readZipEntry(source, entry)));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      throw new BackupError(DAMAGED);
    }
  };
  const byName = new Map(entries.filter((e) => e.name.startsWith('files/') && !e.isDirectory).map((e) => [e.name.slice(6), e] as const));
  const checked = async (ref: string | undefined): Promise<Blob | undefined> => {
    const entry = ref ? byName.get(ref) : undefined;
    if (!entry) return undefined;
    let blob: Blob;
    try {
      blob = await storedEntryBlob(source, entry);
    } catch {
      throw new BackupError(DAMAGED);
    }
    const expected = await readCrc(source, entry.localOffset);
    if (expected !== undefined && expected !== (await crc32Blob(blob))) throw new BackupError(DAMAGED);
    return blob;
  };

  const backupBooks = (await readRows('books')) as BookRecord[];
  const allTracks = (await readRows('tracks')) as TrackRecord[];
  const allChapters = (await readRows('chapters')) as ChapterRecord[];
  const idMap = new Map<string, string>();
  const restored = new Set<string>();
  let booksAlreadyThere = 0;
  let fileCount = 0;
  for (const [i, b] of backupBooks.entries()) {
    progress('Restoring books', i, backupBooks.length);
    const fingerprint = b.fingerprint || b.id;
    const existing = await books.findByFingerprint(fingerprint);
    if (existing) {
      idMap.set(b.id, existing.id);
      booksAlreadyThere += 1;
      continue;
    }
    const tracks: NewTrack[] = [];
    for (const t of allTracks.filter((r) => r.bookId === b.id).sort((x, y) => x.index - y.index)) {
      const file = await checked(t.fileRef);
      if (!file) throw new BackupError(DAMAGED);
      fileCount += 1;
      tracks.push({ file, fileName: baseName(t.fileRef).replace(/^\d+-/, ''), title: t.title, durationSec: t.durationSec, startOffsetSec: t.startOffsetSec });
    }
    const file = tracks.length === 0 ? await checked(b.fileRef) : undefined;
    if (tracks.length === 0 && !file) throw new BackupError(DAMAGED);
    if (file) fileCount += 1;
    const cover = await checked(b.coverRef);
    if (cover) fileCount += 1;
    const chapters: NewChapter[] = allChapters.filter((r) => r.bookId === b.id).map(({ bookId: _b, ...c }) => c);
    const result = await books.add({
      fingerprint,
      kind: b.kind,
      format: b.format,
      title: b.title,
      ...(b.author ? { author: b.author } : {}),
      ...(b.narrator ? { narrator: b.narrator } : {}),
      ...(b.series ? { series: b.series } : {}),
      ...(b.language ? { language: b.language } : {}),
      ...(b.durationSec !== undefined ? { durationSec: b.durationSec } : {}),
      ...(b.pages !== undefined ? { pages: b.pages } : {}),
      addedAt: b.addedAt,
      favorite: b.favorite === true,
      finished: b.finished === true,
      ...(file ? { file, ...(b.fileRef ? { fileName: baseName(b.fileRef) } : {}) } : {}),
      ...(tracks.length > 0 ? { tracks } : {}),
      ...(cover ? { cover } : {}),
      chapters,
    });
    if (result.status === 'duplicate') {
      idMap.set(b.id, result.existing.id);
      booksAlreadyThere += 1;
      continue;
    }
    idMap.set(b.id, result.book.id);
    restored.add(b.id);
    if (b.lastOpenedAt !== undefined) await books.update(result.book.id, { lastOpenedAt: b.lastOpenedAt });
  }
  const remap = (id: string): string | undefined => idMap.get(id);

  progress('Restoring your notes and progress', 0, 1);
  for (const store of ['bookmarks', 'highlights', 'sessions'] as const) {
    const rows = ((await readRows(store)) as { bookId: string }[])
      .filter((r) => restored.has(r.bookId))
      .map((r) => ({ ...r, bookId: remap(r.bookId) as string }));
    await putAll(db, store, rows);
  }
  // Progress: keep the newer position when both sides have one.
  const progressOut: unknown[] = [];
  for (const row of (await readRows('progress')) as { bookId: string; mode: string; updatedAt: number }[]) {
    const bookId = remap(row.bookId);
    if (!bookId) continue;
    const current = await db.progress.get([bookId, row.mode as 'read']);
    if (!current || current.updatedAt < row.updatedAt) progressOut.push({ ...row, bookId });
  }
  await putAll(db, 'progress', progressOut);

  // Shelves: a shelf with the same name is reused, books are added in their saved order.
  const shelves = (await readRows('collections')) as CollectionRecord[];
  const links = (await readRows('collectionBooks')) as CollectionBookRecord[];
  for (const shelf of shelves.sort((a, b) => a.order - b.order)) {
    const current = await collections.list();
    const wanted = shelf.name.trim().toLocaleLowerCase();
    const target = current.find((c) => c.name.trim().toLocaleLowerCase() === wanted) ?? (await collections.create(shelf.name));
    const ids = links
      .filter((l) => l.collectionId === shelf.id)
      .sort((a, b) => a.order - b.order)
      .map((l) => remap(l.bookId))
      .filter((id): id is string => id !== undefined);
    if (ids.length > 0) await collections.addBooks(target.id, ids);
  }
  // Voices and settings are not books: they are copied as they are.
  for (const ref of byName.keys()) {
    if (!ref.startsWith('voices/')) continue;
    const blob = await checked(ref);
    if (blob) {
      await files.write(ref, blob);
      fileCount += 1;
    }
  }
  await putAll(db, 'voices', await readRows('voices'));
  await putAll(db, 'settings', await readRows('settings'));
  progress('Restoring your notes and progress', 1, 1);
  return { booksAdded: restored.size, booksAlreadyThere, files: fileCount };
}

/** CRC-32 stored in the local header of an entry. */
async function readCrc(source: Blob, localOffset: number): Promise<number | undefined> {
  const h = await readRange(source, localOffset, 18);
  if (h.length < 18) return undefined;
  return ((h[14] as number) | ((h[15] as number) << 8) | ((h[16] as number) << 16) | ((h[17] as number) << 24)) >>> 0;
}

/** Bytes used, split the way the Storage screen shows them. */
export async function storageBreakdown(db: PageNestDB, files: FileStore): Promise<StorageBreakdown> {
  const out: StorageBreakdown = { books: 0, audio: 0, covers: 0, voices: 0, caches: 0 };
  const kinds = new Map<string, string>();
  await db.books.each((b) => {
    kinds.set(b.id, b.kind);
  });
  for (const entry of await files.list('books')) {
    if (entry.kind !== 'directory') continue;
    const bytes = await files.usage(`books/${entry.name}`);
    if (kinds.get(entry.name) === 'audio') out.audio += bytes;
    else out.books += bytes;
  }
  out.covers = await files.usage('covers').catch(() => 0);
  out.voices = await files.usage('voices').catch(() => 0);
  out.caches = await files.usage('renders').catch(() => 0);
  return out;
}

/** Delete narrated chapters (they can be made again). Returns how many bytes were freed. */
export async function clearCaches(db: PageNestDB, files: FileStore): Promise<number> {
  const freed = await files.usage('renders').catch(() => 0);
  await files.remove('renders').catch(() => undefined);
  await db.renders.clear();
  return freed;
}
