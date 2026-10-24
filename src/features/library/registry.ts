import type { PageNestDB } from '@/data/db';
import { createFileStore, type FileStore } from '@/data/opfs';
import { LibraryController } from './controller';
import { createWorkerBackend, ImportClient } from './import-client';
import { createSearchClient } from './search-client';

export type { LibraryController };

let sharedFiles: Promise<FileStore> | undefined;
/** The app's file store (OPFS), opened once. */
export function getFileStore(): Promise<FileStore> {
  sharedFiles ??= createFileStore();
  return sharedFiles;
}

const controllers = new WeakMap<PageNestDB, LibraryController>();

/**
 * One controller per database for the whole session, so switching tabs keeps the loaded books,
 * the search index and any import still running.
 */
export function getLibraryController(db: PageNestDB): LibraryController {
  let controller = controllers.get(db);
  if (!controller) {
    controller = new LibraryController({
      db,
      getFiles: getFileStore,
      imports: new ImportClient(createWorkerBackend()),
      search: createSearchClient(),
      requestPersistence: async () => (await import('@/sw/persist')).requestPersistence(),
      takeSharedFiles: async () => (await import('@/sw/share-target')).takeSharedFiles(),
    });
    controllers.set(db, controller);
  }
  return controller;
}

/** Forget the controller of a database (tests). */
export function resetLibraryController(db: PageNestDB): void {
  controllers.get(db)?.dispose();
  controllers.delete(db);
}
