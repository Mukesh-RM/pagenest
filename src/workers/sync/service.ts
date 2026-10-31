import { BookRepository } from '@/data/books';
import { CollectionRepository } from '@/data/collections';
import { newId } from '@/data/db';
import type { FileStore } from '@/data/opfs';
import type { PageNestDB } from '@/data/db';
import { SyncCryptoError } from './crypto';
import type { SyncWorkerEvent, SyncWorkerRequest } from './protocol';
import { exportEncryptedMetadata, exportSyncFile, importEncryptedMetadata, importSyncFile, SyncError } from './sync-io';

export interface SyncServiceDeps {
  db: PageNestDB;
  files: FileStore;
}

function messageFor(error: unknown): string {
  if (error instanceof SyncError || error instanceof SyncCryptoError) return error.message;
  const name = error instanceof Error ? error.name : '';
  if (name === 'QuotaExceededError') return 'There is not enough space on this device. Free some space and try again.';
  return 'Something went wrong while syncing. Please try again.';
}

export function createSyncService(deps: SyncServiceDeps) {
  const books = new BookRepository(deps.db, deps.files);
  const collections = new CollectionRepository(deps.db);
  const mergeDeps = { db: deps.db, books, collections };
  const cancelled = new Set<string>();

  return {
    async handle(request: SyncWorkerRequest, emit: (event: SyncWorkerEvent) => void): Promise<void> {
      const { jobId } = request;
      if (request.type === 'cancel') {
        cancelled.add(jobId);
        return;
      }
      try {
        switch (request.type) {
          case 'sync-export-file': {
            const result = await exportSyncFile(
              deps.db,
              deps.files,
              request.code,
              { includeFiles: request.includeFiles },
              (stage, done, total) => emit({ type: 'progress', jobId, stage, done, total }),
            );
            emit({ type: 'done', jobId, result });
            return;
          }
          case 'sync-import-file': {
            const result = await importSyncFile(
              request.file,
              request.code,
              { ...mergeDeps, files: deps.files, books, collections },
              (stage, done, total) => emit({ type: 'progress', jobId, stage, done, total }),
            );
            emit({ type: 'done', jobId, result });
            return;
          }
          case 'sync-export-encrypted': {
            const encrypted = await exportEncryptedMetadata(deps.db, request.code);
            emit({ type: 'done', jobId, result: encrypted });
            return;
          }
          case 'sync-import-encrypted': {
            const merge = await importEncryptedMetadata(request.encrypted, request.code, mergeDeps);
            emit({ type: 'done', jobId, result: merge });
            return;
          }
        }
      } catch (error) {
        emit({ type: 'failed', jobId, message: messageFor(error) });
      }
    },
  };
}

export const newSyncJobId = (): string => newId();
