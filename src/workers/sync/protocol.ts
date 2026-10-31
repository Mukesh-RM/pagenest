import type { RestoreSummary } from '@/workers/import/protocol';
import type { SyncMergeSummary } from './merge';

export interface SyncFileExportResult {
  blob: Blob;
  fileName: string;
  pairingCode: string;
}

export type SyncImportResult =
  | { kind: 'metadata'; merge: SyncMergeSummary }
  | { kind: 'full'; restore: RestoreSummary; merge: SyncMergeSummary };

export type SyncWorkerRequest =
  | { type: 'sync-export-file'; jobId: string; code: string; includeFiles: boolean }
  | { type: 'sync-import-file'; jobId: string; file: Blob; code: string }
  | { type: 'sync-export-encrypted'; jobId: string; code: string }
  | { type: 'sync-import-encrypted'; jobId: string; encrypted: import('./crypto').EncryptedSyncBlob; code: string }
  | { type: 'cancel'; jobId: string };

export type SyncWorkerEvent =
  | { type: 'progress'; jobId: string; stage: string; done: number; total: number }
  | { type: 'done'; jobId: string; result?: SyncFileExportResult | SyncImportResult | import('./crypto').EncryptedSyncBlob | SyncMergeSummary }
  | { type: 'failed'; jobId: string; message: string };
