import {
  THEMES,
  contrastRatio,
  hexToRgbTriplet,
  isThemePreference,
  resolveTheme,
  themeCssVariables,
  type ThemeName,
} from './themes';

const names = Object.keys(THEMES) as ThemeName[];

describe('themes', () => {
  it('uses the blueprint colors for page, text and accent', () => {
    expect(THEMES.light).toMatchObject({ page: '#FAFAF7', text: '#1C1B19', accent: '#3E5BDB' });
    expect(THEMES.sepia).toMatchObject({ page: '#F4ECD8', text: '#3B2F23', accent: '#A0522D' });
    expect(THEMES.dark).toMatchObject({ page: '#17181C', text: '#E4E2DC', accent: '#8FA6FF' });
    expect(THEMES.black).toMatchObject({ page: '#000000', text: '#CFCDC7', accent: '#8FA6FF' });
  });

  it.each(names)('%s meets WCAG AA (4.5:1) for every text pair', (name) => {
    const t = THEMES[name];
    expect(contrastRatio(t.text, t.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.text, t.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.muted, t.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.muted, t.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.accent, t.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.accent, t.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.onAccent, t.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('computes contrast like WCAG', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('converts hex to triplets and rejects bad input', () => {
    expect(hexToRgbTriplet('#3E5BDB')).toBe('62 91 219');
    expect(() => hexToRgbTriplet('red')).toThrow();
  });

  it('produces every CSS variable Tailwind reads', () => {
    expect(Object.keys(themeCssVariables('dark')).sort()).toEqual(
      ['--pn-accent', '--pn-line', '--pn-muted', '--pn-on-accent', '--pn-page', '--pn-surface', '--pn-text'],
    );
  });

  it('resolves "system" from the device and keeps explicit choices', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('sepia', true)).toBe('sepia');
  });

  it('validates stored preferences', () => {
    expect(isThemePreference('black')).toBe(true);
    expect(isThemePreference('neon')).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
  });
});
