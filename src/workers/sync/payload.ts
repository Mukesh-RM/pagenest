import type { PageNestDB } from '@/data/db';
import type { FileStore } from '@/data/opfs';
import type { SettingRecord } from '@/data/schema';
import { createBackup } from '@/workers/import/backup';

export const SYNC_FORMAT = 'pagenest-sync';
export const SYNC_VERSION = 1;

/** Library metadata and annotations (no book binaries). */
export const SYNC_DATA_STORES = [
  'books',
  'tracks',
  'chapters',
  'progress',
  'bookmarks',
  'highlights',
  'collections',
  'collectionBooks',
  'sessions',
  'settings',
] as const;

export type SyncDataStore = (typeof SYNC_DATA_STORES)[number];

export interface SettingSyncRow extends SettingRecord {
  updatedAt: number;
}

export interface SyncPayload {
  format: typeof SYNC_FORMAT;
  version: number;
  exportedAt: number;
  includeFiles: boolean;
  data: Record<SyncDataStore, unknown[]>;
}

export interface SyncExportOptions {
  includeFiles: boolean;
}

export async function buildMetadataPayload(db: PageNestDB, exportedAt: number): Promise<SyncPayload> {
  const data = {} as Record<SyncDataStore, unknown[]>;
  for (const store of SYNC_DATA_STORES) {
    if (store === 'settings') {
      const rows = await db.settings.toArray();
      data.settings = rows.map((row) => ({ ...row, updatedAt: exportedAt }));
    } else {
      data[store] = await db.table(store).toArray();
    }
  }
  return { format: SYNC_FORMAT, version: SYNC_VERSION, exportedAt, includeFiles: false, data };
}

/** Full library zip (optional book files), built like a backup. */
export async function buildFullLibraryZip(
  db: PageNestDB,
  files: FileStore,
  progress: (stage: string, done: number, total: number) => void,
): Promise<Blob> {
  return createBackup(db, files, progress);
}

export function isSyncPayload(value: unknown): value is SyncPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as SyncPayload;
  return v.format === SYNC_FORMAT && typeof v.version === 'number' && typeof v.exportedAt === 'number' && !!v.data;
}

/** Build a metadata payload from an InkQuiet backup zip (before restore). */
export async function payloadFromBackupZip(source: Blob, exportedAt: number): Promise<SyncPayload> {
  const { readZipEntries, readZipEntry } = await import('@/workers/import/zip');
  const entries = await readZipEntries(source);
  const data = {} as Record<SyncDataStore, unknown[]>;
  for (const store of SYNC_DATA_STORES) {
    const entry = entries.find((e) => e.name === `data/${store}.json`);
    if (!entry) {
      data[store] = [];
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(new TextDecoder().decode(await readZipEntry(source, entry)));
      data[store] = Array.isArray(parsed) ? parsed : [];
    } catch {
      data[store] = [];
    }
  }
  return { format: SYNC_FORMAT, version: SYNC_VERSION, exportedAt, includeFiles: true, data };
}
