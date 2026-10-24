import { THEME_PALETTE } from '@/ui/theme/palette';
import {
  THEMES,
  THEME_LABELS,
  THEME_LIST,
  THEME_PREFERENCES,
  contrastRatio,
  isThemePreference,
  type ThemeName,
} from './themes';

describe('themes (adapter over the design system palette)', () => {
  it('uses the blueprint colors for page, text and accent', () => {
    const lower = (t: { page: string; text: string; accent: string }) => [t.page, t.text, t.accent].map((c) => c.toLowerCase());
    expect(lower(THEMES.light)).toEqual(['#fafaf7', '#1c1b19', '#3e5bdb']);
    expect(lower(THEMES.sepia)).toEqual(['#f4ecd8', '#3b2f23', '#a0522d']);
    expect(lower(THEMES.dark)).toEqual(['#17181c', '#e4e2dc', '#8fa6ff']);
    expect(lower(THEMES.black)).toEqual(['#000000', '#cfcdc7', '#8fa6ff']);
  });

  it.each(THEME_LIST as readonly ThemeName[])('%s is read from the shared palette, not a second table', (name) => {
    const p = THEME_PALETTE[name];
    expect(THEMES[name]).toMatchObject({
      page: p.page,
      surface: p.surface,
      text: p.text,
      muted: p.muted,
      accent: p.accent,
      onAccent: p['on-accent'],
      line: p.line,
    });
  });

  it.each(THEME_LIST as readonly ThemeName[])('%s meets WCAG AA (4.5:1) for the pairs the app uses', (name) => {
    const t = THEMES[name];
    expect(contrastRatio(t.text, t.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.text, t.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.muted, t.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.muted, t.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.onAccent, t.accent)).toBeGreaterThanOrEqual(4.5);
    // Swatches and the Check mark: accent drawn on the theme's own page.
    expect(contrastRatio(t.accent, t.page)).toBeGreaterThanOrEqual(3);
  });

  it('computes contrast like WCAG', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
    expect(() => contrastRatio('red', '#fff')).toThrow();
  });

  it('offers system plus the four themes, each with a label', () => {
    expect(THEME_PREFERENCES).toEqual(['system', 'light', 'sepia', 'dark', 'black']);
    for (const p of THEME_PREFERENCES) expect(THEME_LABELS[p].length).toBeGreaterThan(0);
  });

  it('validates stored preferences', () => {
    expect(isThemePreference('black')).toBe(true);
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('neon')).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
  });
});
