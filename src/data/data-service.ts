import { BookRepository } from './books';
import { CollectionRepository } from './collections';
import { computeFingerprint } from './fingerprint';
import { LibraryQueryService } from './library-query';
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
  /** Books, their files and covers; see `BookRepository`. */
  books: BookApi;
  /** Shelves; see `CollectionRepository`. */
  collections: CollectionApi;
  /** Search, filter, sort and page the library; see `LibraryQueryService`. */
  library: LibraryApi;
}

/** The `BookRepository` methods that are available through the worker. */
export type BookApi = Pick<
  BookRepository,
  | 'get'
  | 'getMany'
  | 'findByFingerprint'
  | 'count'
  | 'getTracks'
  | 'getChapters'
  | 'add'
  | 'update'
  | 'markOpened'
  | 'setChapters'
  | 'setCover'
  | 'removeCover'
  | 'getCover'
  | 'trash'
  | 'restore'
  | 'purge'
  | 'purgeAll'
  | 'remove'
  | 'cleanupOrphans'
>;

export type CollectionApi = Pick<
  CollectionRepository,
  'list' | 'get' | 'create' | 'rename' | 'remove' | 'reorder' | 'addBooks' | 'removeBooks' | 'reorderBooks' | 'booksIn' | 'shelvesOf'
>;

export type LibraryApi = Pick<LibraryQueryService, 'query' | 'count'>;

export { DATA_SERVICE_METHODS } from './data-service-methods';


export interface DataServiceDeps {
  readonly db: PageNestDB;
  /** The file store, or a promise for it (opening OPFS is asynchronous). */
  readonly files: FileStore | Promise<FileStore>;
}

/** A {@link DataService} plus `dispose`, which is deliberately not callable through the worker. */
export interface DisposableDataService extends DataService {
  /** Stop listening to database changes. */
  dispose(): void;
}

export function createDataService({ db, files }: DataServiceDeps): DisposableDataService {
  const store = (): Promise<FileStore> => Promise.resolve(files);
  const library = new LibraryQueryService(db);
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
    books: new BookRepository(db, files),
    collections: new CollectionRepository(db),
    library,
    dispose: () => library.close(),
  };
}
