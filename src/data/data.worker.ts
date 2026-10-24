import { PageNestDB } from './db';
import { createDataService } from './data-service';
import { createFileStore } from './opfs';
import { serveRpc, type RpcPort } from './rpc';

/**
 * Web Worker entry. Owns its own IndexedDB connection and the OPFS file store, and answers the
 * typed calls of `DataService`. Started lazily by `createDataClient`; never at app start.
 */
serveRpc(self as unknown as RpcPort, createDataService({ db: new PageNestDB(), files: createFileStore() }));
