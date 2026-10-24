/** Result of asking the browser to keep our data (blueprint 6 and 14). */
export type PersistResult =
  | { supported: false; persisted: false }
  | { supported: true; persisted: boolean; usageBytes?: number; quotaBytes?: number };

export interface StorageManagerLike {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
}

function defaultStorage(): StorageManagerLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as unknown as { storage?: StorageManagerLike }).storage;
}

/**
 * Ask for persistent storage. Safe to call again: it only asks when not yet granted.
 * Call it after the first import and from the Settings "Keep my data" button, never at first paint.
 * Never throws.
 */
export async function requestPersistence(storage: StorageManagerLike | undefined = defaultStorage()): Promise<PersistResult> {
  if (!storage || typeof storage.persist !== 'function' || typeof storage.persisted !== 'function') {
    return { supported: false, persisted: false };
  }
  let persisted = false;
  try {
    persisted = (await storage.persisted()) || (await storage.persist());
  } catch {
    persisted = false;
  }
  const result: PersistResult = { supported: true, persisted };
  try {
    const estimate = await storage.estimate?.();
    if (estimate?.usage !== undefined) result.usageBytes = estimate.usage;
    if (estimate?.quota !== undefined) result.quotaBytes = estimate.quota;
  } catch {
    /* usage unknown */
  }
  return result;
}
