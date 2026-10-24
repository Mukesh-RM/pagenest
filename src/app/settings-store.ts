import { create } from 'zustand';
import { getSetting, setSetting, SETTING_KEYS } from '@/data/settings';
import type { PageNestDB } from '@/data/db';
import { isThemePreference, type ThemePreference } from './themes';

interface SettingsState {
  /** False until saved settings were read from IndexedDB. */
  loaded: boolean;
  themePreference: ThemePreference;
  /** Read saved settings. Missing or invalid values keep their defaults. */
  load: (db: PageNestDB) => Promise<void>;
  /** Change and save the app theme. The change shows immediately. */
  setThemePreference: (db: PageNestDB, preference: ThemePreference) => Promise<void>;
}

/** App-level settings (Zustand). Persisted through the `settings` store. */
export const useSettings = create<SettingsState>((set) => ({
  loaded: false,
  themePreference: 'system',
  async load(db) {
    let saved: unknown;
    try {
      saved = await getSetting<unknown>(db, SETTING_KEYS.appTheme);
    } catch {
      // Storage blocked or closed: keep the defaults and still show the app.
    }
    set({ loaded: true, ...(isThemePreference(saved) ? { themePreference: saved } : {}) });
  },
  async setThemePreference(db, preference) {
    set({ themePreference: preference });
    try {
      await setSetting(db, SETTING_KEYS.appTheme, preference);
    } catch {
      // The theme still changes for this visit even if it cannot be saved.
    }
  },
}));
