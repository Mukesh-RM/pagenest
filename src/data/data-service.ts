import { computeFingerprint } from './fingerprint';
import type { PageNestDB } from './db';
import type { FileData, FileEntry, FileStore } from './opfs';
import { computeStats, type StatsSummary } from './stats';

/**
 * Work that must not run on the main thread: file I/O in OPFS, hashing, and aggregation over
 * the database. It runs inside `data.worker.ts`; the same code runs in-process as a fallback
 * where Web Workers do not exist (and in tests). Arguments and results are plain,
 * structured-cloneable data, so the service can sit behind `serveRpc`.
 */
export interface DataService {
  /** Which file backend is in use and whether files survive a reload. */
  fileStoreInfo(): Promise<{ kind: FileStore['kind']; persistent: boolean }>;
  writeFile(path: string, data: FileData): Promise<void>;
  openFile(path: string): Promise<File>;
  fileExists(path: string): Promise<boolean>;
  fileSize(path: string): Promise<number>;
  removeFile(path: string): Promise<void>;
  listFiles(path?: string): Promise<FileEntry[]>;
  fileUsage(path?: string): Promise<number>;
  /** Size plus hash of the first and last megabyte (blueprint 6). */
  fingerprint(file: Blob): Promise<string>;
  /** Everything the Stats screen shows. `now` is epoch ms. */
  stats(now: number): Promise<StatsSummary>;
}

/** Names of every {@link DataService} method, for building the RPC client. */
export const DATA_SERVICE_METHODS = [
  'fileStoreInfo',
  'writeFile',
  'openFile',
  'fileExists',
  'fileSize',
  'removeFile',
  'listFiles',
  'fileUsage',
  'fingerprint',
  'stats',
] as const satisfies readonly (keyof DataService)[];

export interface DataServiceDeps {
  readonly db: PageNestDB;
  /** The file store, or a promise for it (opening OPFS is asynchronous). */
  readonly files: FileStore | Promise<FileStore>;
}

export function createDataService({ db, files }: DataServiceDeps): DataService {
  const store = (): Promise<FileStore> => Promise.resolve(files);
  return {
    fileStoreInfo: async () => {
      const s = await store();
      return { kind: s.kind, persistent: s.persistent };
    },
    writeFile: async (path, data) => (await store()).write(path, data),
    openFile: async (path) => (await store()).open(path),
    fileExists: async (path) => (await store()).exists(path),
    fileSize: async (path) => (await store()).size(path),
    removeFile: async (path) => (await store()).remove(path),
    listFiles: async (path) => (await store()).list(path),
    fileUsage: async (path) => (await store()).usage(path),
    fingerprint: (file) => computeFingerprint(file),
    stats: (now) => computeStats(db, now),
  };
}
