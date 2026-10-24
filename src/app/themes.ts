/**
 * Theme adapter between the app and the design system.
 *
 * Colors come from `@/ui/theme/palette` (generated from `src/ui/styles/tokens.css`, which
 * is what the browser actually uses), so there is one source of truth. The app only adds
 * what the design system does not have: the Settings wording and a helper to read a
 * theme's colors as one object (used by the onboarding swatches).
 */
import { THEME_PALETTE, THEME_SCHEME } from '@/ui/theme/palette';
import { THEME_MODES, THEME_NAMES, isThemeMode, type ThemeMode, type ThemeName } from '@/ui/theme/themes';

export type { ThemeMode, ThemeName };

/** What the user picks in Settings. `system` follows the device. */
export type ThemePreference = ThemeMode;

export interface ThemeTokens {
  readonly page: string;
  readonly surface: string;
  readonly text: string;
  readonly muted: string;
  readonly accent: string;
  readonly onAccent: string;
  readonly line: string;
  readonly scheme: 'light' | 'dark';
}

function tokensFor(name: ThemeName): ThemeTokens {
  const p = THEME_PALETTE[name];
  return {
    page: p.page,
    surface: p.surface,
    text: p.text,
    muted: p.muted,
    accent: p.accent,
    onAccent: p['on-accent'],
    line: p.line,
    scheme: THEME_SCHEME[name],
  };
}

export const THEMES: Readonly<Record<ThemeName, ThemeTokens>> = {
  light: tokensFor('light'),
  sepia: tokensFor('sepia'),
  dark: tokensFor('dark'),
  black: tokensFor('black'),
};

/** Settings wording: short, warm and plain. */
export const THEME_LABELS: Readonly<Record<ThemePreference, string>> = {
  system: 'Match my phone',
  light: 'Light',
  sepia: 'Sepia',
  dark: 'Dark',
  black: 'Black',
};

export const THEME_PREFERENCES: readonly ThemePreference[] = THEME_MODES;
export const THEME_LIST: readonly ThemeName[] = THEME_NAMES;

export const isThemePreference = isThemeMode;

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Expected a #RRGGBB color, got "${hex}".`);
  const n = parseInt(m[1] as string, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG 2 contrast ratio between two `#RRGGBB` colors (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
