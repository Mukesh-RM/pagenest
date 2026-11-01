import { SyncClient, createSyncWorkerBackend, type SyncBackend } from './sync-client';

let backend: SyncBackend | (() => SyncBackend) = createSyncWorkerBackend;
let client: SyncClient | undefined;

export function setSyncBackend(next: SyncBackend | (() => SyncBackend)): void {
  backend = next;
  client = undefined;
}

export function resetSyncClient(): void {
  client = undefined;
}

export function getSyncClient(): SyncClient {
  if (!client) {
    const resolved = typeof backend === 'function' ? backend() : backend;
    client = new SyncClient(resolved);
  }
  return client;
}
