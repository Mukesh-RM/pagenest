import { THEME_PALETTE } from './palette';

/** The four built-in themes (blueprint 5.2). "Custom" presets are applied by the app on top. */
export const THEME_NAMES = ['light', 'sepia', 'dark', 'black'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

/** App theme setting: a fixed theme, or follow the system light/dark preference. */
export const THEME_MODES = ['system', ...THEME_NAMES] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** What the person can choose in Settings: system, the four built-in themes, or their own colors (blueprint 5.2). */
export const THEME_CHOICES = [...THEME_MODES, 'custom'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'custom' || isThemeMode(value);
}

export const THEME_LABELS: Record<ThemeMode, string> = {
  system: 'System',
  light: 'Light',
  sepia: 'Sepia',
  dark: 'Dark',
  black: 'Black',
};

/** Page color per theme, for `<meta name="theme-color">` and the manifest. Derived from the palette. */
export const THEME_PAGE_COLOR: Record<ThemeName, string> = {
  light: THEME_PALETTE.light.page,
  sepia: THEME_PALETTE.sepia.page,
  dark: THEME_PALETTE.dark.page,
  black: THEME_PALETTE.black.page,
};

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && (THEME_NAMES as readonly string[]).includes(value);
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || isThemeName(value);
}

/** Resolve the app theme setting to a concrete theme. System dark maps to Dark (not Black). */
export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ThemeName {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
  return mode;
}

/** High-contrast option (blueprint 5.8). It layers on top of any of the four themes. */
export const CONTRAST_LEVELS = ['standard', 'high'] as const;
export type ContrastLevel = (typeof CONTRAST_LEVELS)[number];

/** Contrast setting: follow the system (`prefers-contrast: more`), or force standard or high. */
export const CONTRAST_MODES = ['system', ...CONTRAST_LEVELS] as const;
export type ContrastMode = (typeof CONTRAST_MODES)[number];

export const CONTRAST_LABELS: Record<ContrastMode, string> = {
  system: 'System',
  standard: 'Standard',
  high: 'High contrast',
};

export function isContrastLevel(value: unknown): value is ContrastLevel {
  return typeof value === 'string' && (CONTRAST_LEVELS as readonly string[]).includes(value);
}

export function isContrastMode(value: unknown): value is ContrastMode {
  return value === 'system' || isContrastLevel(value);
}

/** Resolve the contrast setting to a concrete level. */
export function resolveContrast(mode: ContrastMode, systemPrefersMore: boolean): ContrastLevel {
  if (mode === 'system') return systemPrefersMore ? 'high' : 'standard';
  return mode;
}
