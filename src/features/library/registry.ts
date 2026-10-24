import { ImportController } from './import-controller';
import { createWorkerBackend, ImportClient } from './import-client';

/**
 * One import controller for the whole session, so switching tabs keeps any import still running and
 * its progress. The books themselves live in the database and are read through the data layer.
 */
let shared: ImportController | undefined;

export function getImportController(): ImportController {
  shared ??= new ImportController({
    imports: new ImportClient(createWorkerBackend()),
    requestPersistence: async () => (await import('@/sw/persist')).requestPersistence(),
    takeSharedFiles: async () => (await import('@/sw/share-target')).takeSharedFiles(),
  });
  return shared;
}

/** Forget the shared controller (tests). */
export function resetImportController(): void {
  shared?.dispose();
  shared = undefined;
}
