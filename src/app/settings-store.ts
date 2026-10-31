import { create } from 'zustand';
import { getSetting, setSetting, SETTING_KEYS } from '@/data/settings';
import type { PageNestDB } from '@/data/db';
import { clampFontSize, FONT_SIZE_DEFAULT, parseSavedFontSize } from './font-size';
import { DEFAULT_CUSTOM_THEME, parseCustomTheme, type CustomThemeInput } from '@/ui/theme/custom';
import { isContrastMode, type ContrastMode } from '@/ui/theme/themes';
import { rememberOnboarded } from './first-run-hint';
import { isThemePreference, type ThemePreference } from './themes';

interface SettingsState {
  /** False until saved settings were read from IndexedDB. */
  loaded: boolean;
  themePreference: ThemePreference;
  /** The Custom theme's colors (used when `themePreference` is `custom`); always valid hex. */
  customTheme: CustomThemeInput;
  /** High contrast: `system` follows the device, or force `standard` / `high`. */
  contrastMode: ContrastMode;
  /** App text size in px, always inside the allowed range. */
  fontSizePx: number;
  /** True once first-run onboarding was finished or skipped. */
  onboardingDone: boolean;
  /** Read saved settings. Missing or invalid values keep their defaults. */
  load: (db: PageNestDB) => Promise<void>;
  /** Change and save the app theme. The change shows immediately. */
  setThemePreference: (db: PageNestDB, preference: ThemePreference) => Promise<void>;
  /** Change and save the Custom theme's colors. The change shows immediately. */
  setCustomTheme: (db: PageNestDB, colors: CustomThemeInput) => Promise<void>;
  /** Change and save the contrast mode. The change shows immediately. */
  setContrastMode: (db: PageNestDB, mode: ContrastMode) => Promise<void>;
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

/** How long the text size slider must sit still before the value is written to IndexedDB. */
export const FONT_SIZE_SAVE_DELAY_MS = 250;

interface PendingFontSave {
  db: PageNestDB;
  size: number;
  timer: ReturnType<typeof setTimeout>;
  done: Promise<void>;
  finish: () => void;
}

let pendingFont: PendingFontSave | undefined;

/**
 * Write a pending text size now. Dragging the slider changes the screen on every tick, but the
 * database is written once, when the slider rests (or sooner: when the page is hidden or onboarding ends).
 */
export function flushSettings(): Promise<void> {
  const job = pendingFont;
  if (!job) return Promise.resolve();
  pendingFont = undefined;
  clearTimeout(job.timer);
  return persist(job.db, SETTING_KEYS.fontSizePx, job.size).then(job.finish);
}

function scheduleFontSave(db: PageNestDB, size: number): Promise<void> {
  const previous = pendingFont;
  if (previous) clearTimeout(previous.timer);
  let finish!: () => void;
  const done = previous?.done ?? new Promise<void>((resolve) => (finish = resolve));
  const job: PendingFontSave = {
    db,
    size,
    done,
    finish: previous?.finish ?? finish,
    timer: setTimeout(() => void flushSettings(), FONT_SIZE_SAVE_DELAY_MS),
  };
  pendingFont = job;
  return done;
}

/** App-level settings (Zustand). Persisted through the `settings` store. */
export const useSettings = create<SettingsState>((set) => ({
  loaded: false,
  themePreference: 'system',
  customTheme: { ...DEFAULT_CUSTOM_THEME },
  contrastMode: 'system',
  fontSizePx: FONT_SIZE_DEFAULT,
  onboardingDone: false,
  async load(db) {
    let theme: unknown;
    let custom: unknown;
    let contrast: unknown;
    let font: unknown;
    let done: unknown;
    try {
      [theme, custom, contrast, font, done] = await Promise.all([
        getSetting<unknown>(db, SETTING_KEYS.appTheme),
        getSetting<unknown>(db, SETTING_KEYS.customTheme),
        getSetting<unknown>(db, SETTING_KEYS.contrastMode),
        getSetting<unknown>(db, SETTING_KEYS.fontSizePx),
        getSetting<unknown>(db, SETTING_KEYS.onboardingDone),
      ]);
    } catch {
      // Storage blocked or closed: keep the defaults and still show the app.
    }
    const size = parseSavedFontSize(font);
    if (done !== undefined || theme !== undefined || font !== undefined) rememberOnboarded(done === true);
    set((state) => ({
      loaded: true,
      themePreference: isThemePreference(theme) ? theme : state.themePreference,
      customTheme: parseCustomTheme(custom) ?? state.customTheme,
      contrastMode: isContrastMode(contrast) ? contrast : state.contrastMode,
      fontSizePx: size ?? state.fontSizePx,
      onboardingDone: done === true || state.onboardingDone,
    }));
  },
  async setThemePreference(db, preference) {
    set({ themePreference: preference });
    await persist(db, SETTING_KEYS.appTheme, preference);
  },
  async setCustomTheme(db, colors) {
    set({ customTheme: colors });
    await persist(db, SETTING_KEYS.customTheme, colors);
  },
  async setContrastMode(db, mode) {
    set({ contrastMode: mode });
    await persist(db, SETTING_KEYS.contrastMode, mode);
  },
  async setFontSizePx(db, px) {
    const size = clampFontSize(px);
    set({ fontSizePx: size });
    await scheduleFontSave(db, size);
  },
  async completeOnboarding(db) {
    set({ onboardingDone: true });
    await flushSettings();
    await persist(db, SETTING_KEYS.onboardingDone, true);
    rememberOnboarded(true);
  },
}));
