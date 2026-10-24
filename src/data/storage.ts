/**
 * Browser storage status for the Settings "Storage used" row
 * (blueprint sections 6 and 14). No network code.
 */

export interface StorageStatus {
  /** Bytes used by this origin, or `undefined` when the browser will not say. */
  usageBytes?: number;
  /** Bytes the browser allows, or `undefined` when unknown. */
  quotaBytes?: number;
  /** True when the browser promised not to clear our data. `undefined` when unknown. */
  persisted?: boolean;
}

interface StorageManagerLike {
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
}

function manager(): StorageManagerLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as unknown as { storage?: StorageManagerLike }).storage;
}

/** Read current usage and persistence. Never throws. */
export async function getStorageStatus(): Promise<StorageStatus> {
  const storage = manager();
  const status: StorageStatus = {};
  try {
    const estimate = await storage?.estimate?.();
    if (estimate?.usage !== undefined) status.usageBytes = estimate.usage;
    if (estimate?.quota !== undefined) status.quotaBytes = estimate.quota;
  } catch {
    /* unknown */
  }
  try {
    const persisted = await storage?.persisted?.();
    if (persisted !== undefined) status.persisted = persisted;
  } catch {
    /* unknown */
  }
  return status;
}

/**
 * Ask the browser to keep our data (call on first import, from a user action).
 * Resolves `true` when granted, `false` when refused or unsupported.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await manager()?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/** Format bytes for people: `1.4 MB`. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}
