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
  /** `ThemePreference`: `system`, `light`, `sepia`, `dark`, `black` or `custom`. */
  appTheme: 'appTheme',
  /** The three colors of the Custom theme (`{ page, text, accent }` as `#rrggbb`). */
  customTheme: 'customTheme',
  /** `ContrastMode`: `system` (follow `prefers-contrast`), `standard` or `high`. */
  contrastMode: 'contrastMode',
  /** Text size in px for the whole app (see `src/app/font-size.ts`). */
  fontSizePx: 'fontSizePx',
  /** `true` once the first-run onboarding was finished or skipped. */
  onboardingDone: 'onboardingDone',
  /** `ReaderSettings` (size, font, theme, spacing, margins) chosen in the reader's "Aa" sheet. */
  readerSettings: 'readerSettings',
} as const;
