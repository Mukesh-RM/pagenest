import { create } from 'zustand';
import { getSetting, setSetting, SETTING_KEYS } from '@/data/settings';
import type { PageNestDB } from '@/data/db';
import { clampFontSize, FONT_SIZE_DEFAULT, parseSavedFontSize } from './font-size';
import { isThemePreference, type ThemePreference } from './themes';

interface SettingsState {
  /** False until saved settings were read from IndexedDB. */
  loaded: boolean;
  themePreference: ThemePreference;
  /** App text size in px, always inside the allowed range. */
  fontSizePx: number;
  /** True once first-run onboarding was finished or skipped. */
  onboardingDone: boolean;
  /** Read saved settings. Missing or invalid values keep their defaults. */
  load: (db: PageNestDB) => Promise<void>;
  /** Change and save the app theme. The change shows immediately. */
  setThemePreference: (db: PageNestDB, preference: ThemePreference) => Promise<void>;
  /** Change and save the app text size (clamped). The change shows immediately. */
  setFontSizePx: (db: PageNestDB, px: number) => Promise<void>;
  /** Mark onboarding as finished, for both Done and Skip. Never shown again. */
  completeOnboarding: (db: PageNestDB) => Promise<void>;
}

/** Save a value; the visible change already happened, so a storage failure must not break the screen. */
async function persist(db: PageNestDB, key: string, value: unknown): Promise<void> {
  try {
    await setSetting(db, key, value);
  } catch {
    // Storage blocked or closed: the change still holds for this visit.
  }
}

/** App-level settings (Zustand). Persisted through the `settings` store. */
export const useSettings = create<SettingsState>((set) => ({
  loaded: false,
  themePreference: 'system',
  fontSizePx: FONT_SIZE_DEFAULT,
  onboardingDone: false,
  async load(db) {
    let theme: unknown;
    let font: unknown;
    let done: unknown;
    try {
      [theme, font, done] = await Promise.all([
        getSetting<unknown>(db, SETTING_KEYS.appTheme),
        getSetting<unknown>(db, SETTING_KEYS.fontSizePx),
        getSetting<unknown>(db, SETTING_KEYS.onboardingDone),
      ]);
    } catch {
      // Storage blocked or closed: keep the defaults and still show the app.
    }
    const size = parseSavedFontSize(font);
    set((state) => ({
      loaded: true,
      themePreference: isThemePreference(theme) ? theme : state.themePreference,
      fontSizePx: size ?? state.fontSizePx,
      onboardingDone: done === true || state.onboardingDone,
    }));
  },
  async setThemePreference(db, preference) {
    set({ themePreference: preference });
    await persist(db, SETTING_KEYS.appTheme, preference);
  },
  async setFontSizePx(db, px) {
    const size = clampFontSize(px);
    set({ fontSizePx: size });
    await persist(db, SETTING_KEYS.fontSizePx, size);
  },
  async completeOnboarding(db) {
    set({ onboardingDone: true });
    await persist(db, SETTING_KEYS.onboardingDone, true);
  },
}));
