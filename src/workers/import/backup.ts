import type { PageNestDB } from '@/data/db';
import type { FileStore } from '@/data/opfs';
import type { BookRecord } from '@/data/schema';
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
  return `PageNest backup ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.zip`;
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

/**
 * Restore a backup into the library. Safe to run on a library that already has books: books with
 * the same fingerprint are kept as they are (their progress is merged), everything else is added.
 */
export async function restoreBackup(source: Blob, db: PageNestDB, files: FileStore, progress: Progress = () => undefined): Promise<RestoreSummary> {
  let entries;
  try {
    entries = await readZipEntries(source);
  } catch (error) {
    if (error instanceof ZipError) throw new BackupError('This file does not look like a PageNest backup, or it is damaged.');
    throw error;
  }
  const manifestEntry = entries.find((e) => e.name === MANIFEST_NAME);
  if (!manifestEntry) throw new BackupError('This file is not a PageNest backup.');
  let manifest: Manifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(await readZipEntry(source, manifestEntry, 1_000_000))) as Manifest;
  } catch {
    throw new BackupError('This backup is damaged. Try another copy.');
  }
  if (manifest.format !== BACKUP_FORMAT) throw new BackupError('This file is not a PageNest backup.');
  if (manifest.version > BACKUP_VERSION) throw new BackupError('This backup was made by a newer PageNest. Update the app, then try again.');

  const readRows = async (store: DataStore): Promise<unknown[]> => {
    const entry = entries.find((e) => e.name === `data/${store}.json`);
    if (!entry) return [];
    try {
      const parsed: unknown = JSON.parse(new TextDecoder().decode(await readZipEntry(source, entry)));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      throw new BackupError('This backup is damaged. Try another copy.');
    }
  };

  // Decide which backed-up books are already in the library (same fingerprint).
  const backupBooks = (await readRows('books')) as BookRecord[];
  const idMap = new Map<string, string>();
  const skipIds = new Set<string>();
  for (const b of backupBooks) {
    const existing = await db.books.where('fingerprint').equals(b.fingerprint).first();
    if (existing && existing.id !== b.id) {
      idMap.set(b.id, existing.id);
      skipIds.add(b.id);
    }
  }
  const remap = (id: string): string => idMap.get(id) ?? id;

  // Files first, so the library never points at a file that is not there yet.
  const fileEntries = entries.filter((e) => e.name.startsWith('files/') && !e.isDirectory);
  const wanted = fileEntries.filter((e) => {
    const ref = e.name.slice(6);
    const m = /^(?:books\/([^/]+)\/|covers\/([^/.]+)\.)/.exec(ref);
    const bookId = m?.[1] ?? m?.[2];
    return !(bookId && skipIds.has(bookId));
  });
  const total = wanted.reduce((n, e) => n + e.size, 0);
  let done = 0;
  for (const entry of wanted) {
    const ref = entry.name.slice(6);
    let blob: Blob;
    try {
      blob = await storedEntryBlob(source, entry);
    } catch {
      throw new BackupError('This backup is damaged. Try another copy.');
    }
    const base = done;
    const crc = await crc32Blob(blob, (bytes) => progress('Checking files', base + bytes, total));
    const expected = await readCrc(source, entry.localOffset);
    if (expected !== undefined && expected !== crc) throw new BackupError('This backup is damaged. Try another copy.');
    await files.write(ref, blob);
    done += entry.size;
    progress('Restoring files', done, total);
  }

  progress('Restoring your library', 0, 1);
  const added = backupBooks.filter((b) => !skipIds.has(b.id));
  await putAll(db, 'books', added);
  for (const store of ['tracks', 'chapters', 'bookmarks', 'highlights', 'sessions'] as const) {
    const rows = ((await readRows(store)) as { bookId: string }[]).filter((r) => !skipIds.has(r.bookId));
    await putAll(db, store, rows);
  }
  // Progress: keep the newer position when both sides have one.
  const progressRows = (await readRows('progress')) as { bookId: string; mode: string; updatedAt: number }[];
  const progressOut: unknown[] = [];
  for (const row of progressRows) {
    const bookId = remap(row.bookId);
    const current = await db.progress.get([bookId, row.mode as 'read']);
    if (!current || current.updatedAt < row.updatedAt) progressOut.push({ ...row, bookId });
  }
  await putAll(db, 'progress', progressOut);
  await putAll(db, 'collections', await readRows('collections'));
  const links = ((await readRows('collectionBooks')) as { bookId: string }[]).map((r) => ({ ...r, bookId: remap(r.bookId) }));
  await putAll(db, 'collectionBooks', links);
  await putAll(db, 'voices', await readRows('voices'));
  await putAll(db, 'settings', await readRows('settings'));
  progress('Restoring your library', 1, 1);
  return { booksAdded: added.length, booksAlreadyThere: skipIds.size, files: wanted.length };
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

/** Remove files that no book points at (an import that was cut short, for example). */
export async function sweepOrphans(db: PageNestDB, files: FileStore): Promise<number> {
  let removed = 0;
  const known = new Set<string>();
  await db.books.each((b) => {
    known.add(b.id);
  });
  for (const entry of await files.list('books')) {
    if (!known.has(entry.name)) {
      await files.remove(`books/${entry.name}`);
      removed += 1;
    }
  }
  for (const entry of await files.list('covers')) {
    const id = entry.name.replace(/\.[^.]*$/, '');
    if (!known.has(id)) {
      await files.remove(`covers/${entry.name}`);
      removed += 1;
    }
  }
  return removed;
}
