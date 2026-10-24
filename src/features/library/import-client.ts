import type { WorkerEvent, WorkerRequest } from '@/workers/import/protocol';

/**
 * Talks to the import worker. A backend is anything that takes requests and delivers events:
 * the real Web Worker in the app, a direct call into the service in unit tests.
 */
export interface ImportBackend {
  post(request: WorkerRequest): void;
  subscribe(listener: (event: WorkerEvent) => void): () => void;
}

const WORKER_PROBLEM = 'This browser cannot add files in the background. Please update it and try again.';

/** The real backend: one module worker, started the first time it is needed. */
export function createWorkerBackend(): ImportBackend {
  let worker: Worker | undefined;
  const listeners = new Set<(event: WorkerEvent) => void>();
  const failAll = (message: string): void => {
    for (const listener of listeners) listener({ type: 'failed', jobId: '*', message });
  };
  const start = (): Worker => {
    const w = new Worker(new URL('../../workers/import/import.worker.ts', import.meta.url), { type: 'module' });
    w.addEventListener('message', (e: MessageEvent<WorkerEvent>) => {
      for (const listener of listeners) listener(e.data);
    });
    w.addEventListener('error', () => {
      worker = undefined; // the next request starts a fresh worker
      failAll('Something went wrong while adding files. Please try again.');
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

export interface JobHandle<R> {
  jobId: string;
  /** Resolves with the worker's result, rejects with an `Error` in plain words. */
  done: Promise<R>;
  cancel(): void;
}

type RequestBody = WorkerRequest extends infer R ? (R extends { jobId: string } ? Omit<R, 'jobId'> : never) : never;

let counter = 0;
export function newJobId(): string {
  counter += 1;
  return `job-${Date.now().toString(36)}-${counter}`;
}

/** Starts jobs on a backend and routes their events. */
export class ImportClient {
  constructor(private readonly backend: ImportBackend) {}

  run<R = unknown>(body: RequestBody, onEvent?: (event: WorkerEvent) => void): JobHandle<R> {
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
    this.backend.post({ ...body, jobId } as WorkerRequest);
    return { jobId, done, cancel: () => this.backend.post({ type: 'cancel', jobId }) };
  }
}
