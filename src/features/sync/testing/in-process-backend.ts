import type { SyncWorkerEvent, SyncWorkerRequest } from '@/workers/sync/protocol';
import { BookRepository } from '@/data/books';
import { CollectionRepository } from '@/data/collections';
import type { PageNestDB } from '@/data/db';
import { MemoryFileStore, type FileStore } from '@/data/opfs';
import { createSyncService } from '@/workers/sync/service';

export interface SyncBackend {
  post(request: SyncWorkerRequest): void;
  subscribe(listener: (event: SyncWorkerEvent) => void): () => void;
}

/** Runs the sync service in-thread (tests). */
export function inProcessSyncBackend(db: PageNestDB, files: FileStore = new MemoryFileStore()): SyncBackend & { files: FileStore } {
  const service = createSyncService({ db, files });
  const listeners = new Set<(event: SyncWorkerEvent) => void>();
  return {
    files,
    post(request: SyncWorkerRequest) {
      queueMicrotask(() => {
        void service.handle(request, (event) => {
          for (const listener of [...listeners]) listener(event);
        });
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export { BookRepository, CollectionRepository };
