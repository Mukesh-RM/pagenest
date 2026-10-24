import { BookRepository } from '@/data/books';
import { CollectionRepository } from '@/data/collections';
import type { PageNestDB } from '@/data/db';
import { MemoryFileStore, type FileStore } from '@/data/opfs';
import { parseAudio } from '@/workers/import/parsers/audio';
import type { WorkerEvent, WorkerRequest } from '@/workers/import/protocol';
import { createImportService } from '@/workers/import/service';
import type { ImportBackend } from '../import-client';

/**
 * An import backend that runs the real import service in this thread (tests only). It is what the
 * import worker runs, minus the Worker, so tests exercise the same sniffing, parsing and storage.
 */
export function inProcessBackend(db: PageNestDB, files: FileStore = new MemoryFileStore()): ImportBackend & { files: FileStore } {
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
      // Events arrive asynchronously, like they do from a worker.
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
