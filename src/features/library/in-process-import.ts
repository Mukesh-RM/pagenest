import { BookRepository } from '@/data/books';
import { CollectionRepository } from '@/data/collections';
import type { PageNestDB } from '@/data/db';
import { MemoryFileStore, type FileStore } from '@/data/opfs';
import { parseAudio } from '@/workers/import/parsers/audio';
import type { WorkerEvent, WorkerRequest } from '@/workers/import/protocol';
import { createImportService } from '@/workers/import/service';
import type { ImportBackend } from './import-client';

/**
 * Runs the real import service on the main thread with a given file store. Used when OPFS is
 * unavailable so imports and playback share one store (separate workers each had their own memory store).
 */
export function inProcessImportBackend(db: PageNestDB, files: FileStore = new MemoryFileStore()): ImportBackend & { files: FileStore } {
  const service = createImportService({
    db,
    files,
    books: new BookRepository(db, files),
    collections: new CollectionRepository(db),
    parseAudio,
    makeThumbnail: async () => undefined,
  });
  const listeners = new Set<(event: WorkerEvent) => void>();
  return {
    files,
    post(request: WorkerRequest) {
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
