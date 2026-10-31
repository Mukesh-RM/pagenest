import { getDb } from '@/data/db';
import { openOpfsRoot } from '@/data/opfs';
import { setStorageBootstrap, type StorageBootstrap } from './storage-bootstrap-state';

/**
 * When OPFS is missing or blocked, the import worker and data worker would each use a separate
 * in-memory file store, so imported bytes never reach the player. Align import and data on one store.
 */
export async function bootstrapStorage(): Promise<void> {
  const root = await openOpfsRoot();
  if (root) return;
  const [{ createCacheBackedFileStore }, { inProcessImportBackend }, { setImportBackend }] = await Promise.all([
    import('@/data/cache-file-store'),
    import('@/features/library/in-process-import'),
    import('@/features/library/registry'),
  ]);
  const db = getDb();
  const files = createCacheBackedFileStore();
  setImportBackend(() => inProcessImportBackend(db, files));
  const boot: StorageBootstrap = {
    sharedFiles: files,
    dataClient: { workerFactory: () => undefined, files },
  };
  setStorageBootstrap(boot);
}
