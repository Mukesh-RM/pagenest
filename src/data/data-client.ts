import { getDb, type PageNestDB } from './db';
import type { DataService, DisposableDataService } from './data-service';
import { DATA_SERVICE_METHODS } from './data-service-methods';
import type { FileData, FileEntry, FileStore } from './opfs';
import { createRpcClient, type Remote, type RpcPort } from './rpc';

/** The main-thread handle for {@link DataService}. Every call is asynchronous and off-thread when a worker exists. */
export type DataClient = Remote<DataService> & {
  /** Stop the worker (if any). The client starts a new one on the next call. */
  close(): void;
  /** True when calls run in a Web Worker, false for the in-process fallback. */
  readonly usesWorker: boolean;
};

export interface DataClientOptions {
  /**
   * Make the worker, or return `undefined` to run in-process. The default starts
   * `data.worker.ts` when `Worker` exists.
   */
  workerFactory?: () => (RpcPort & { terminate?: () => void }) | undefined;
  /** Database for the in-process fallback. Defaults to the shared app database. */
  db?: PageNestDB;
  /** File store for the in-process fallback. Defaults to OPFS, or memory when OPFS is missing. */
  files?: FileStore | Promise<FileStore>;
}

function defaultWorkerFactory(): (RpcPort & { terminate: () => void }) | undefined {
  if (typeof Worker === 'undefined') return undefined;
  return new Worker(new URL('./data.worker.ts', import.meta.url), { type: 'module' });
}

/**
 * Create the data client. Nothing starts until the first call, so the worker and its copy of the
 * database code are never part of first paint. Falls back to running in-process, with the same
 * behavior, where Web Workers are unavailable.
 */
export function createDataClient(options: DataClientOptions = {}): DataClient {
  const workerFactory = options.workerFactory ?? defaultWorkerFactory;
  let connection: { api: Remote<DataService>; stop: () => void; worker: boolean } | undefined;

  function connect(): NonNullable<typeof connection> {
    if (connection) return connection;
    let worker: ReturnType<typeof workerFactory>;
    try {
      worker = workerFactory();
    } catch {
      worker = undefined;
    }
    if (worker) {
      const rpc = createRpcClient<DataService>(worker, DATA_SERVICE_METHODS);
      connection = {
        api: rpc.api,
        worker: true,
        stop: () => {
          rpc.close();
          worker.terminate?.();
        },
      };
    } else {
      // The service is loaded on demand, so a browser that has Workers never downloads this copy of it.
      const local: Promise<DisposableDataService> = Promise.all([
        import('./data-service'),
        options.files ?? import('./opfs').then((m) => m.createFileStore()),
      ]).then(([m, files]) => m.createDataService({ db: options.db ?? getDb(), files }));
      const api: Record<string, unknown> = {};
      for (const method of DATA_SERVICE_METHODS) {
        const path = method.split('.');
        const name = path.pop() ?? method;
        let target = api;
        for (const part of path) target = (target[part] ??= {}) as Record<string, unknown>;
        target[name] = async (...args: unknown[]) => {
          let owner = (await local) as unknown as Record<string, unknown>;
          for (const part of path) owner = owner[part] as Record<string, unknown>;
          return (owner[name] as (...a: unknown[]) => unknown).apply(owner, args);
        };
      }
      connection = {
        api: api as Remote<DataService>,
        stop: () =>
          void local.then(
            (l) => l.dispose(),
            () => undefined,
          ),
        worker: false,
      };
    }
    return connection;
  }

  const client: Record<string, unknown> = {
    close() {
      connection?.stop();
      connection = undefined;
    },
  };
  Object.defineProperty(client, 'usesWorker', { get: () => connect().worker });
  for (const method of DATA_SERVICE_METHODS) {
    const path = method.split('.');
    const name = path.pop() ?? method;
    let target = client;
    for (const part of path) target = (target[part] ??= {}) as Record<string, unknown>;
    target[name] = (...args: unknown[]) => {
      let owner = connect().api as unknown as Record<string, unknown>;
      for (const part of path) owner = owner[part] as Record<string, unknown>;
      return (owner[name] as (...a: unknown[]) => Promise<unknown>).apply(owner, args);
    };
  }
  return client as DataClient;
}

/**
 * A {@link FileStore} whose work happens in the worker, for code that expects the plain
 * `FileStore` interface (import, covers, voice models). Same behavior as the direct stores.
 */
export function createWorkerFileStore(data: DataClient, info: { kind: FileStore['kind']; persistent: boolean }): FileStore {
  return {
    kind: info.kind,
    persistent: info.persistent,
    write: (path: string, d: FileData) => data.writeFile(path, d),
    open: (path: string) => data.openFile(path),
    exists: (path: string) => data.fileExists(path),
    size: (path: string) => data.fileSize(path),
    remove: (path: string) => data.removeFile(path),
    list: (path?: string): Promise<FileEntry[]> => data.listFiles(path),
    usage: (path?: string) => data.fileUsage(path),
  };
}
