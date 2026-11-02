import { getDb } from '@/data/db';
import { createCacheBackedFileStore } from '@/data/cache-file-store';
import { OpfsFileStore, openOpfsRoot } from '@/data/opfs';
import { importModule } from '@/app/chunk-import';
import { setStorageBootstrap, storageBootstrap, type StorageBootstrap } from './storage-bootstrap-state';

let booting: Promise<void> | undefined;

/**
 * One shared file store for imports, the data client, and the reader. Imports always run in-process on this store
 * so book bytes are never written to a separate worker memory store (Android Chrome can expose OPFS on the page but not
 * in the import worker).
 */
export async function bootstrapStorage(): Promise<void> {
  if (storageBootstrap()) return;
  if (booting) return booting;
  booting = (async () => {
    const root = await openOpfsRoot();
    const files = root ? new OpfsFileStore(root) : createCacheBackedFileStore();

    const [{ inProcessImportBackend }, { setImportBackend }] = await Promise.all([
      importModule(() => import('@/features/library/in-process-import')),
      importModule(() => import('@/features/library/registry')),
    ]);

    const db = getDb();
    setImportBackend(() => inProcessImportBackend(db, files));

    const boot: StorageBootstrap = {
      sharedFiles: files,
      dataClient: { workerFactory: () => undefined, files },
    };
    setStorageBootstrap(boot);

    void import('@/sw/persist').then((m) => m.requestPersistence());
  })();
  return booting;
}
