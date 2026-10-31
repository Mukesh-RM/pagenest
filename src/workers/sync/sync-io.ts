import type { PageNestDB } from '@/data/db';
import type { FileStore } from '@/data/opfs';
import { restoreBackup, type RestoreDeps } from '@/workers/import/backup';
import { decryptBytes, encryptBytes, type EncryptedSyncBlob } from './crypto';
import {
  buildFullLibraryZip,
  buildMetadataPayload,
  isSyncPayload,
  payloadFromBackupZip,
  type SyncExportOptions,
  type SyncPayload,
} from './payload';
import { mergeSyncPayload, type SyncMergeDeps, type SyncMergeSummary } from './merge';

export const SYNC_FILE_EXTENSION = '.pnsync';

export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncError';
  }
}

export interface SyncFileExport {
  blob: Blob;
  fileName: string;
  pairingCode: string;
}

export interface SyncApplyResult {
  kind: 'metadata';
  merge: SyncMergeSummary;
}

export interface SyncFullRestoreResult {
  kind: 'full';
  restore: Awaited<ReturnType<typeof restoreBackup>>;
  merge: SyncMergeSummary;
}

function syncFileName(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `InkQuiet sync ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}${SYNC_FILE_EXTENSION}`;
}

/** Metadata-only export: encrypted JSON payload. */
export async function exportSyncFile(
  db: PageNestDB,
  files: FileStore,
  code: string,
  options: SyncExportOptions,
  progress: (stage: string, done: number, total: number) => void,
  now: () => Date = () => new Date(),
): Promise<SyncFileExport> {
  progress('Preparing sync', 0, 1);
  let plain: Uint8Array;
  if (options.includeFiles) {
    const zip = await buildFullLibraryZip(db, files, progress);
    plain = new Uint8Array(await zip.arrayBuffer());
  } else {
    const payload = await buildMetadataPayload(db, now().getTime());
    plain = new TextEncoder().encode(JSON.stringify(payload));
  }
  const encrypted = await encryptBytes(plain, code);
  const blob = new Blob([JSON.stringify(encrypted)], { type: 'application/json' });
  return { blob, fileName: syncFileName(now()), pairingCode: code };
}

export async function readEncryptedFile(file: Blob): Promise<EncryptedSyncBlob> {
  try {
    const text = typeof file.text === 'function' ? await file.text() : new TextDecoder().decode(await file.arrayBuffer());
    const parsed = JSON.parse(text) as EncryptedSyncBlob;
    if (parsed?.format !== 'pagenest-sync-encrypted') throw new SyncError('This file is not an InkQuiet sync package.');
    return parsed;
  } catch (error) {
    if (error instanceof SyncError) throw error;
    throw new SyncError('This file is not an InkQuiet sync package.');
  }
}

/** Import encrypted sync file and merge into the current library. */
export async function importSyncFile(
  file: Blob,
  code: string,
  deps: RestoreDeps & SyncMergeDeps,
  progress: (stage: string, done: number, total: number) => void,
): Promise<SyncApplyResult | SyncFullRestoreResult> {
  const encrypted = await readEncryptedFile(file);
  const plain = await decryptBytes(encrypted, code);
  progress('Merging', 0, 1);

  // Full library zip (PK header).
  if (plain[0] === 0x50 && plain[1] === 0x4b) {
    const zip = new Blob([plain as BlobPart]);
    const payload = await payloadFromBackupZip(zip, Date.now());
    const merge = await mergeSyncPayload(payload, deps);
    const restore = await restoreBackup(zip, deps, progress);
    return { kind: 'full', restore, merge };
  }

  let payload: SyncPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(plain)) as SyncPayload;
  } catch {
    throw new SyncError('The sync data is damaged.');
  }
  if (!isSyncPayload(payload)) throw new SyncError('This file is not an InkQuiet sync package.');
  const merge = await mergeSyncPayload(payload, deps);
  progress('Merging', 1, 1);
  return { kind: 'metadata', merge };
}

/** Build encrypted bytes for QR / WebRTC (metadata only). */
export async function exportEncryptedMetadata(db: PageNestDB, code: string, now: () => Date = () => new Date()): Promise<EncryptedSyncBlob> {
  const payload = await buildMetadataPayload(db, now().getTime());
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  return encryptBytes(plain, code);
}

/** Decrypt QR/WebRTC payload and merge. */
export async function importEncryptedMetadata(
  encrypted: EncryptedSyncBlob,
  code: string,
  deps: SyncMergeDeps,
): Promise<SyncMergeSummary> {
  const plain = await decryptBytes(encrypted, code);
  const payload = JSON.parse(new TextDecoder().decode(plain)) as SyncPayload;
  if (!isSyncPayload(payload)) throw new SyncError('This sync package is not from InkQuiet.');
  return mergeSyncPayload(payload, deps);
}

export type { SyncMergeSummary };
