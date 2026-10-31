import { PageNestDB } from '@/data/db';
import { createFileStore, openOpfsRoot, type FileStore } from '@/data/opfs';
import { streamingFileStore } from '@/workers/import/opfs-stream';
import type { SyncWorkerEvent, SyncWorkerRequest } from './protocol';
import { createSyncService } from './service';

/**
 * Sync worker: encrypted export/import and merge. Uses the same storage as the import worker
 * (own IndexedDB + OPFS connection in this thread).
 */
const filesPromise = createFileStore();
const rootPromise = openOpfsRoot();

const service = (async () => {
  const [files, root] = await Promise.all([filesPromise, rootPromise]);
  const db = new PageNestDB();
  const store: FileStore = root ? streamingFileStore(files, root) : files;
  return createSyncService({ db, files: store });
})();

const post = (event: SyncWorkerEvent): void => (self as unknown as { postMessage: (m: SyncWorkerEvent) => void }).postMessage(event);

self.addEventListener('message', (event: MessageEvent<SyncWorkerRequest>) => {
  void service.then((s) => s.handle(event.data, post));
});

export { createSyncService };
