import { ImportController } from './import-controller';
import { createWorkerBackend, ImportClient, type ImportBackend } from './import-client';

/**
 * One import controller for the whole session, so switching tabs keeps any import still running and
 * its progress. The books themselves live in the database and are read through the data layer.
 */
let shared: ImportController | undefined;
let client: ImportClient | undefined;
let backendFactory: () => ImportBackend = createWorkerBackend;

/** Use another backend (tests run the import service in-process). Call `resetImportController` first. */
export function setImportBackend(factory: () => ImportBackend): void {
  backendFactory = factory;
}

/** The worker client shared by imports, backup and storage jobs. */
export function getImportClient(): ImportClient {
  client ??= new ImportClient(backendFactory());
  return client;
}

export function getImportController(): ImportController {
  shared ??= new ImportController({
    imports: getImportClient(),
    requestPersistence: async () => (await import('@/sw/persist')).requestPersistence(),
    takeSharedFiles: async () => (await import('@/sw/share-target')).takeSharedFiles(),
  });
  return shared;
}

/** Forget the shared controller (tests). */
export function resetImportController(): void {
  shared?.dispose();
  shared = undefined;
  client = undefined;
  backendFactory = createWorkerBackend;
}
