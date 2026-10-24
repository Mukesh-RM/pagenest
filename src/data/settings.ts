import type { PageNestDB } from './db';

/** Typed access to the `settings` key-value store (themes, fonts, skip times, defaults). */
export async function getSetting<T>(db: PageNestDB, key: string): Promise<T | undefined> {
  const row = await db.settings.get(key);
  return row?.value as T | undefined;
}

export async function setSetting(db: PageNestDB, key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

/** Names of settings the app shell reads and writes. */
export const SETTING_KEYS = {
  appTheme: 'appTheme',
} as const;
