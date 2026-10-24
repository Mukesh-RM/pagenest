/**
 * Theme tokens (blueprint section 5.2).
 *
 * This file is the single adapter between the app and the design tokens. The
 * four named themes use the blueprint's page, text and accent colors exactly;
 * the other roles (surface, muted, line, on-accent) are derived so every text
 * pair meets WCAG AA (4.5:1), which `themes.test.ts` checks. When the UI
 * designer publishes tokens in `src/ui`, change only this file to read them.
 */

export type ThemeName = 'light' | 'sepia' | 'dark' | 'black';

/** What the user picks in Settings. `system` follows the device. */
export type ThemePreference = ThemeName | 'system';

export interface ThemeTokens {
  readonly page: string;
  readonly surface: string;
  readonly text: string;
  readonly muted: string;
  readonly accent: string;
  readonly onAccent: string;
  readonly line: string;
  /** Used for the browser UI color (`color-scheme`). */
  readonly scheme: 'light' | 'dark';
}

export const THEMES: Readonly<Record<ThemeName, ThemeTokens>> = {
  light: {
    page: '#FAFAF7',
    surface: '#FFFFFF',
    text: '#1C1B19',
    muted: '#5C5A55',
    accent: '#3E5BDB',
    onAccent: '#FFFFFF',
    line: '#E3E1DA',
    scheme: 'light',
  },
  sepia: {
    page: '#F4ECD8',
    surface: '#FBF6E8',
    text: '#3B2F23',
    muted: '#6B5A47',
    accent: '#A0522D',
    onAccent: '#FFFFFF',
    line: '#D9CCAA',
    scheme: 'light',
  },
  dark: {
    page: '#17181C',
    surface: '#202228',
    text: '#E4E2DC',
    muted: '#A9A7A0',
    accent: '#8FA6FF',
    onAccent: '#0B1020',
    line: '#33353D',
    scheme: 'dark',
  },
  black: {
    page: '#000000',
    surface: '#111111',
    text: '#CFCDC7',
    muted: '#A3A19B',
    accent: '#8FA6FF',
    onAccent: '#0B1020',
    line: '#2A2A2A',
    scheme: 'dark',
  },
};

export const THEME_LABELS: Readonly<Record<ThemePreference, string>> = {
  system: 'Match my phone',
  light: 'Light',
  sepia: 'Sepia',
  dark: 'Dark',
  black: 'Black',
};

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'sepia', 'dark', 'black'];

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** Turn a preference into a concrete theme given the device's dark-mode setting. */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ThemeName {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

/** `#RRGGBB` to `"r g b"`, the form Tailwind's `rgb(var(--x) / <alpha-value>)` needs. */
export function hexToRgbTriplet(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Expected a #RRGGBB color, got "${hex}".`);
  const n = parseInt(m[1] as string, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** CSS variables (name to value) for a theme. */
export function themeCssVariables(theme: ThemeName): Record<string, string> {
  const t = THEMES[theme];
  return {
    '--pn-page': hexToRgbTriplet(t.page),
    '--pn-surface': hexToRgbTriplet(t.surface),
    '--pn-text': hexToRgbTriplet(t.text),
    '--pn-muted': hexToRgbTriplet(t.muted),
    '--pn-accent': hexToRgbTriplet(t.accent),
    '--pn-on-accent': hexToRgbTriplet(t.onAccent),
    '--pn-line': hexToRgbTriplet(t.line),
  };
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2 contrast ratio between two `#RRGGBB` colors (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string): number => {
    const [r, g, bl] = hexToRgbTriplet(hex).split(' ').map(Number) as [number, number, number];
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(bl);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
