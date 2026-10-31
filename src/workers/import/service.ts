import { newId } from '@/data/db';
import { Importer, type ImportDeps } from './importer';
import { backupFileName, clearCaches, createBackup, restoreBackup, storageBreakdown, BackupError, type RestoreDeps } from './backup';
import type { ImportSummary, WorkerEvent, WorkerRequest } from './protocol';

/**
 * Turns requests into work and events. `import.worker.ts` wires it to `postMessage`; tests and the
 * no-Worker fallback call `handle` directly.
 */
export interface ImportService {
  handle(request: WorkerRequest, emit: (event: WorkerEvent) => void): Promise<void>;
}

/** The plain-words message for an error that reaches the person. */
function messageFor(error: unknown): string {
  if (error instanceof BackupError) return error.message;
  const name = error instanceof Error ? error.name : '';
  if (name === 'QuotaExceededError') return 'There is not enough space on this device. Free some space and try again.';
  return 'Something went wrong. Please try again.';
}

export type ImportServiceDeps = ImportDeps & Omit<RestoreDeps, 'books'>;

export function createImportService(deps: ImportServiceDeps): ImportService {
  const importer = new Importer(deps);
  const cancelled = new Set<string>();
  return {
    async handle(request, emit) {
      const { jobId } = request;
      try {
        switch (request.type) {
          case 'cancel':
            cancelled.add(request.jobId);
            return;
          case 'import': {
            const summary: ImportSummary = {
              added: 0,
              duplicates: 0,
              unsupported: 0,
              skipped: 0,
            };
            try {
              await importer.importAll(request.items, {
                isCancelled: () => cancelled.has(jobId),
                onStart: (total) => emit({ type: 'started', jobId, total }),
                onOutcome: (outcome, done, total) => {
                  if (outcome.status === 'added') summary.added += 1;
                  else if (outcome.status === 'duplicate') summary.duplicates += 1;
                  else if (outcome.status === 'unsupported') summary.unsupported += 1;
                  else summary.skipped += 1;
                  emit({ type: 'outcome', jobId, outcome, done, total });
                },
              });
            } finally {
              cancelled.delete(jobId);
            }
            emit({ type: 'done', jobId, result: summary });
            return;
          }
          case 'backup': {
            const blob = await createBackup(deps.db, deps.files, (stage, done, total) =>
              emit({ type: 'progress', jobId, stage, done, total }),
            );
            emit({
              type: 'done',
              jobId,
              result: { blob, fileName: backupFileName() },
            });
            return;
          }
          case 'restore': {
            const result = await restoreBackup(request.file, deps, (stage, done, total) =>
              emit({ type: 'progress', jobId, stage, done, total }),
            );
            emit({ type: 'done', jobId, result });
            return;
          }
          case 'usage':
            emit({
              type: 'done',
              jobId,
              result: await storageBreakdown(deps.db, deps.files),
            });
            return;
          case 'clear-caches':
            emit({
              type: 'done',
              jobId,
              result: { removed: await clearCaches(deps.db, deps.files) },
            });
            return;
        }
      } catch (error) {
        emit({ type: 'failed', jobId, message: messageFor(error) });
      }
    },
  };
}

/** A fresh job id. */
export const newJobId = (): string => newId();
