import type { SyncWorkerEvent, SyncWorkerRequest } from '@/workers/sync/protocol';

export interface SyncBackend {
  post(request: SyncWorkerRequest): void;
  subscribe(listener: (event: SyncWorkerEvent) => void): () => void;
}

const WORKER_PROBLEM = 'This browser cannot sync in the background. Please update it and try again.';

export function createSyncWorkerBackend(): SyncBackend {
  let worker: Worker | undefined;
  const listeners = new Set<(event: SyncWorkerEvent) => void>();
  const failAll = (message: string): void => {
    for (const listener of listeners) listener({ type: 'failed', jobId: '*', message });
  };
  const start = (): Worker => {
    const w = new Worker(new URL('../../workers/sync/sync.worker.ts', import.meta.url), { type: 'module' });
    w.addEventListener('message', (e: MessageEvent<SyncWorkerEvent>) => {
      for (const listener of listeners) listener(e.data);
    });
    w.addEventListener('error', () => {
      worker = undefined;
      failAll('Something went wrong while syncing. Please try again.');
    });
    return w;
  };
  return {
    post(request) {
      try {
        worker ??= start();
        worker.postMessage(request);
      } catch {
        worker = undefined;
        failAll(WORKER_PROBLEM);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export interface SyncJobHandle<R> {
  jobId: string;
  done: Promise<R>;
  cancel(): void;
}

type RequestBody = SyncWorkerRequest extends infer R ? (R extends { jobId: string } ? Omit<R, 'jobId'> : never) : never;

let counter = 0;
function newJobId(): string {
  counter += 1;
  return `sync-${Date.now().toString(36)}-${counter}`;
}

export class SyncClient {
  constructor(private readonly backend: SyncBackend) {}

  run<R = unknown>(body: RequestBody, onEvent?: (event: SyncWorkerEvent) => void): SyncJobHandle<R> {
    const jobId = newJobId();
    let off: (() => void) | undefined;
    const done = new Promise<R>((resolve, reject) => {
      off = this.backend.subscribe((event) => {
        if (event.jobId !== jobId && event.jobId !== '*') return;
        if (event.type === 'failed') {
          off?.();
          reject(new Error(event.message));
          return;
        }
        onEvent?.(event);
        if (event.type === 'done') {
          off?.();
          resolve(event.result as R);
        }
      });
    });
    this.backend.post({ ...body, jobId } as SyncWorkerRequest);
    return { jobId, done, cancel: () => this.backend.post({ type: 'cancel', jobId }) };
  }
}
