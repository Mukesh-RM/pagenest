import type { DataClientOptions } from '@/data/data-client';
import type { FileStore } from '@/data/opfs';

export interface StorageBootstrap {
  readonly dataClient: Pick<DataClientOptions, 'workerFactory' | 'files'>;
  readonly sharedFiles: FileStore;
}

let bootstrap: StorageBootstrap | undefined;

export function setStorageBootstrap(next: StorageBootstrap): void {
  bootstrap = next;
}

export function storageBootstrap(): StorageBootstrap | undefined {
  return bootstrap;
}
