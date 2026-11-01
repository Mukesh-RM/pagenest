import type { FileRef } from '@/app/contracts';

/**
 * File storage for book bytes, covers, voice models and rendered audio
 * (blueprint section 6: "file bytes in the browser's private file system").
 *
 * `createFileStore()` returns an OPFS-backed store when the browser has one,
 * and an in-memory store otherwise, so the app still works (without keeping
 * files after a reload). Check `store.kind` and `store.persistent` to tell the
 * user plainly when files will not be kept. No network code lives here.
 */

/** Why a file operation failed. */
export type FileStoreErrorCode = 'invalid-path' | 'not-found' | 'unsupported';

export class FileStoreError extends Error {
  readonly code: FileStoreErrorCode;
  constructor(code: FileStoreErrorCode, message: string) {
    super(message);
    this.name = 'FileStoreError';
    this.code = code;
  }
}

/** Data accepted by {@link FileStore.write}. */
export type FileData = Blob | ArrayBuffer | ArrayBufferView | string;

/** Entry returned by {@link FileStore.list}. */
export interface FileEntry {
  readonly name: string;
  readonly kind: 'file' | 'directory';
}

/** A tiny file system API shared by the OPFS and in-memory stores. Paths are {@link FileRef}s. */
export interface FileStore {
  /** Which backend is in use. */
  readonly kind: 'opfs' | 'memory';
  /** True when files survive a page reload. */
  readonly persistent: boolean;
  /** Create or replace a file, creating parent folders. */
  write(path: FileRef, data: FileData): Promise<void>;
  /** The file as a `Blob`-like `File` (lazy for OPFS, so large files are not loaded whole). */
  open(path: FileRef): Promise<File>;
  exists(path: FileRef): Promise<boolean>;
  /** Size in bytes. */
  size(path: FileRef): Promise<number>;
  /** Delete a file or a whole folder. Missing paths are ignored. */
  remove(path: FileRef): Promise<void>;
  /** Entries directly inside a folder; `''` lists the root. Missing folders give `[]`. */
  list(path?: FileRef): Promise<FileEntry[]>;
  /** Total bytes of all files under a folder; `''` measures everything. */
  usage(path?: FileRef): Promise<number>;
}

/** Split and validate a path: relative, `/`-separated, no empty, `.` or `..` parts. */
export function parsePath(path: FileRef, allowEmpty = false): string[] {
  if (path === '' && allowEmpty) return [];
  const parts = path.split('/');
  const bad = parts.some((p) => p === '' || p === '.' || p === '..' || p.includes('\\') || p.includes('\u0000'));
  if (bad || path.startsWith('/')) {
    throw new FileStoreError('invalid-path', `"${path}" is not a valid file path.`);
  }
  return parts;
}

async function toBlob(data: FileData): Promise<Blob> {
  if (data instanceof Blob) return data;
  if (typeof data === 'string') return new Blob([data], { type: 'text/plain' });
  return new Blob([data as BlobPart]);
}

// ---------------------------------------------------------------------------
// OPFS
// ---------------------------------------------------------------------------

/** The slice of `FileSystemWritableFileStream` we use. */
export interface WritableLike {
  write(data: Blob | BufferSource | string): Promise<void>;
  close(): Promise<void>;
}

/** The slice of `FileSystemSyncAccessHandle` we use (workers only; Safari's way to write). */
export interface SyncAccessHandleLike {
  write(buffer: BufferSource, options?: { at?: number }): number;
  truncate(size: number): void;
  flush(): void;
  close(): void;
}

/** The slice of `FileSystemFileHandle` we use. */
export interface FileHandleLike {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<File>;
  createWritable?(options?: { keepExistingData?: boolean }): Promise<WritableLike>;
  createSyncAccessHandle?(): Promise<SyncAccessHandleLike>;
}

/** The slice of `FileSystemDirectoryHandle` we use. */
export interface DirectoryHandleLike {
  readonly kind: 'directory';
  readonly name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  entries(): AsyncIterable<[string, FileHandleLike | DirectoryHandleLike]>;
}

interface StorageManagerLike {
  getDirectory?: () => Promise<DirectoryHandleLike>;
}

function storageManager(): StorageManagerLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as unknown as { storage?: StorageManagerLike }).storage;
}

/** Cheap check: does this browser expose the OPFS entry point? It may still fail to open (see {@link openOpfsRoot}). */
export function isOpfsSupported(): boolean {
  return typeof storageManager()?.getDirectory === 'function';
}

/**
 * QA harness: skip OPFS and use the cache-backed file store (same path as a blocked OPFS open).
 * Set `?pn_no_opfs=1` on first load or `sessionStorage.pn_no_opfs = '1'` before bootstrap (e2e only).
 */
export function isOpfsHarnessDisabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('pn_no_opfs') === '1') return true;
    return sessionStorage.getItem('pn_no_opfs') === '1';
  } catch {
    return false;
  }
}

/** Open the OPFS root, or `undefined` when unsupported or blocked (for example private mode in some browsers). */
export async function openOpfsRoot(): Promise<DirectoryHandleLike | undefined> {
  if (isOpfsHarnessDisabled()) return undefined;
  const getDirectory = storageManager()?.getDirectory;
  if (typeof getDirectory !== 'function') return undefined;
  try {
    return await getDirectory.call(storageManager());
  } catch {
    return undefined;
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && (error.name === 'NotFoundError' || error.name === 'TypeMismatchError');
}

async function writeToHandle(handle: FileHandleLike, blob: Blob): Promise<void> {
  if (typeof handle.createWritable === 'function') {
    const writable = await handle.createWritable();
    try {
      await writable.write(blob);
    } finally {
      await writable.close();
    }
    return;
  }
  if (typeof handle.createSyncAccessHandle === 'function') {
    // Browsers without createWritable on the main thread (older Safari) only
    // allow synchronous handles, and only inside a worker.
    const access = await handle.createSyncAccessHandle();
    try {
      access.truncate(0);
      access.write(await blob.arrayBuffer(), { at: 0 });
      access.flush();
    } finally {
      access.close();
    }
    return;
  }
  throw new FileStoreError('unsupported', 'This browser cannot save files here.');
}

/** {@link FileStore} on top of a directory handle (normally the OPFS root). */
export class OpfsFileStore implements FileStore {
  readonly kind = 'opfs';
  readonly persistent = true;

  constructor(private readonly root: DirectoryHandleLike) {}

  async write(path: FileRef, data: FileData): Promise<void> {
    const parts = parsePath(path);
    const name = parts.pop() as string;
    let dir = this.root;
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
    const handle = await dir.getFileHandle(name, { create: true });
    await writeToHandle(handle, await toBlob(data));
  }

  async open(path: FileRef): Promise<File> {
    const parts = parsePath(path);
    const name = parts.pop() as string;
    try {
      const dir = await this.dirFor(parts, false);
      return await (await dir.getFileHandle(name)).getFile();
    } catch (error) {
      if (isNotFound(error)) throw new FileStoreError('not-found', `"${path}" does not exist.`);
      throw error;
    }
  }

  async exists(path: FileRef): Promise<boolean> {
    try {
      await this.open(path);
      return true;
    } catch (error) {
      if (error instanceof FileStoreError && error.code === 'not-found') return false;
      throw error;
    }
  }

  async size(path: FileRef): Promise<number> {
    return (await this.open(path)).size;
  }

  async remove(path: FileRef): Promise<void> {
    const parts = parsePath(path);
    const name = parts.pop() as string;
    try {
      const dir = await this.dirFor(parts, false);
      await dir.removeEntry(name, { recursive: true });
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }

  async list(path: FileRef = ''): Promise<FileEntry[]> {
    try {
      const dir = await this.dirFor(parsePath(path, true), false);
      const out: FileEntry[] = [];
      for await (const [name, handle] of dir.entries()) out.push({ name, kind: handle.kind });
      return out.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  async usage(path: FileRef = ''): Promise<number> {
    let total = 0;
    for (const entry of await this.list(path)) {
      const child = path === '' ? entry.name : `${path}/${entry.name}`;
      total += entry.kind === 'directory' ? await this.usage(child) : await this.size(child);
    }
    return total;
  }

  private async dirFor(parts: string[], create: boolean): Promise<DirectoryHandleLike> {
    let dir = this.root;
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
    return dir;
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

/** Fallback {@link FileStore} that keeps files in memory. Files are lost on reload. */
export class MemoryFileStore implements FileStore {
  readonly kind = 'memory';
  readonly persistent = false;
  private readonly files = new Map<string, Blob>();

  async write(path: FileRef, data: FileData): Promise<void> {
    parsePath(path);
    this.files.set(path, await toBlob(data));
  }

  async open(path: FileRef): Promise<File> {
    parsePath(path);
    const blob = this.files.get(path);
    if (!blob) throw new FileStoreError('not-found', `"${path}" does not exist.`);
    return new File([blob], path.slice(path.lastIndexOf('/') + 1), { type: blob.type });
  }

  async exists(path: FileRef): Promise<boolean> {
    parsePath(path);
    return this.files.has(path);
  }

  async size(path: FileRef): Promise<number> {
    return (await this.open(path)).size;
  }

  async remove(path: FileRef): Promise<void> {
    parsePath(path);
    this.files.delete(path);
    const prefix = `${path}/`;
    for (const key of [...this.files.keys()]) if (key.startsWith(prefix)) this.files.delete(key);
  }

  async list(path: FileRef = ''): Promise<FileEntry[]> {
    parsePath(path, true);
    const prefix = path === '' ? '' : `${path}/`;
    const seen = new Map<string, FileEntry>();
    for (const key of this.files.keys()) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const slash = rest.indexOf('/');
      const name = slash === -1 ? rest : rest.slice(0, slash);
      seen.set(name, { name, kind: slash === -1 ? 'file' : 'directory' });
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async usage(path: FileRef = ''): Promise<number> {
    parsePath(path, true);
    const prefix = path === '' ? '' : `${path}/`;
    let total = 0;
    for (const [key, blob] of this.files) if (key.startsWith(prefix) || key === path) total += blob.size;
    return total;
  }
}

/**
 * Pick the best available store: OPFS when it opens, memory otherwise.
 * Never throws.
 */
export async function createFileStore(): Promise<FileStore> {
  const root = await openOpfsRoot();
  return root ? new OpfsFileStore(root) : new MemoryFileStore();
}

/**
 * Same file store as imports and the data client after {@link bootstrapStorage} (cache-backed when OPFS is blocked).
 */
export async function resolveFileStore(): Promise<FileStore> {
  const { storageBootstrap } = await import('@/app/storage-bootstrap-state');
  const boot = storageBootstrap();
  if (boot?.sharedFiles) return boot.sharedFiles;
  return createFileStore();
}

/** Conventional OPFS locations, so every feature uses the same layout. */
export const FilePaths = {
  book: (bookId: string, fileName: string): FileRef => `books/${bookId}/${fileName}`,
  cover: (bookId: string): FileRef => `covers/${bookId}.img`,
  track: (bookId: string, index: number, fileName: string): FileRef =>
    `books/${bookId}/tracks/${String(index).padStart(4, '0')}-${fileName}`,
  voiceModel: (voiceId: string): FileRef => `voices/${voiceId}`,
  render: (bookId: string, chapterIndex: number, voiceId: string, style: string): FileRef =>
    `renders/${bookId}/${chapterIndex}-${voiceId}-${style}.opus`,
  /** Offline dictionary or translation pack bytes (JSON). */
  /** @deprecated Prefer {@link definitionPackPath} / {@link lexiconPackPath} in dictionary pack-paths. */
  dictionaryPack: (packId: string): FileRef => `dictionaries/${packId}.json`,
} as const;
