// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../test/contrast';
import { declarationsFor, parseCss, readUiFile, tripletToHex } from '../test/css';
import { HIGH_CONTRAST_PALETTE, HIGH_CONTRAST_SCRIM_OPACITY, HIGH_CONTRAST_TOKENS, getPalette } from '../theme/palette';
import { THEME_NAMES, type ThemeName } from '../theme/themes';

/**
 * High-contrast option (blueprint 5.8): computed from the REAL tokens.css, for every
 * theme x high-contrast combination. Text pairs must reach 7:1 (WCAG AAA); non-text UI 3:1 or more.
 */

const rules = parseCss(readUiFile('styles/tokens.css'));
const SYSTEM_MEDIA = '@media (prefers-contrast: more)';

const baseSelector = (theme: ThemeName) => `[data-theme="${theme}"]`;
const highSelector = (theme: ThemeName) => `[data-theme="${theme}"][data-contrast="high"]`;
const systemSelector = (theme: ThemeName) => `[data-theme="${theme}"]:not([data-contrast])`;

/** Tokens of a theme with the high-contrast layer applied on top. */
function highTokens(theme: ThemeName): Record<string, string> {
  return { ...declarationsFor(rules, baseSelector(theme)), ...declarationsFor(rules, highSelector(theme)) };
}

function hex(tokens: Record<string, string>, name: string): string {
  const value = tokens[`--pn-${name}`];
  expect(value, `--pn-${name}`).toBeDefined();
  return tripletToHex(value!);
}

const TEXT = 7;
const SURFACES = ['page', 'surface', 'surface-raised'] as const;

interface Pair {
  name: string;
  fg: string;
  bg: string;
  min: number;
}

const PAIRS: Pair[] = [
  ...SURFACES.map((s) => ({ name: `text on ${s}`, fg: 'text', bg: s, min: TEXT })),
  ...SURFACES.map((s) => ({ name: `secondary text on ${s}`, fg: 'muted', bg: s, min: TEXT })),
  { name: 'button text on accent', fg: 'on-accent', bg: 'accent', min: TEXT },
  ...SURFACES.map((s) => ({ name: `link on ${s}`, fg: 'link', bg: s, min: TEXT })),
  ...SURFACES.map((s) => ({ name: `danger text on ${s}`, fg: 'danger', bg: s, min: TEXT })),
  { name: 'snackbar text', fg: 'inverse-text', bg: 'inverse-surface', min: TEXT },
  { name: 'snackbar Undo action', fg: 'inverse-accent', bg: 'inverse-surface', min: TEXT },
  { name: 'accent as text on page', fg: 'accent', bg: 'page', min: TEXT },
  ...SURFACES.map((s) => ({ name: `accent-ink on ${s}`, fg: 'accent-ink', bg: s, min: TEXT })),
  { name: 'accent-ink on accent-soft (chips)', fg: 'accent-ink', bg: 'accent-soft', min: TEXT },
  // Non-text UI: stronger than the 3:1 minimum.
  ...SURFACES.map((s) => ({ name: `focus ring on ${s}`, fg: 'focus-ring', bg: s, min: 7 })),
  ...SURFACES.map((s) => ({ name: `accent fill vs ${s}`, fg: 'accent', bg: s, min: 7 })),
  ...SURFACES.map((s) => ({ name: `control border on ${s}`, fg: 'border-strong', bg: s, min: 4.5 })),
  ...SURFACES.map((s) => ({ name: `hairline and card border on ${s}`, fg: 'line', bg: s, min: 3 })),
];

describe('high-contrast token layer', () => {
  it('has a rule for every theme, overriding exactly the documented tokens plus the scrim', () => {
    const expected = [...HIGH_CONTRAST_TOKENS.map((t) => `--pn-${t}`), '--pn-scrim-opacity'].sort();
    for (const theme of THEME_NAMES) {
      const layer = declarationsFor(rules, highSelector(theme));
      expect(Object.keys(layer).sort(), theme).toEqual(expected);
    }
  });

  it('keeps the light theme as the default when no data-theme is set', () => {
    const rootLayer = declarationsFor(rules, ':root:not([data-theme])[data-contrast="high"]');
    expect(rootLayer).toEqual(declarationsFor(rules, highSelector('light')));
  });

  it('uses thicker strokes in high contrast and resets them for "standard" scopes', () => {
    const base = declarationsFor(rules, ':root');
    const high = declarationsFor(rules, '[data-contrast="high"]');
    const standard = declarationsFor(rules, '[data-contrast="standard"]');
    const px = (v: string) => Number.parseFloat(v);
    expect(px(high['--pn-focus-width']!)).toBeGreaterThan(px(base['--pn-focus-width']!));
    expect(px(high['--pn-border-width']!)).toBeGreaterThan(px(base['--pn-border-width']!));
    expect(px(high['--pn-focus-width']!)).toBeGreaterThanOrEqual(3);
    expect(standard['--pn-focus-width']).toBe(base['--pn-focus-width']);
    expect(standard['--pn-border-width']).toBe(base['--pn-border-width']);
  });

  it('follows prefers-contrast: more when no data-contrast is set, with the same values', () => {
    for (const theme of THEME_NAMES) {
      const system = declarationsFor(rules, systemSelector(theme), SYSTEM_MEDIA);
      expect(system, theme).toEqual(declarationsFor(rules, highSelector(theme)));
    }
    const rootSystem = declarationsFor(rules, ':root:not([data-theme]):not([data-contrast])', SYSTEM_MEDIA);
    expect(rootSystem).toEqual(declarationsFor(rules, highSelector('light')));
    const strokes = declarationsFor(rules, ':root:not([data-contrast])', SYSTEM_MEDIA);
    expect(strokes).toEqual(declarationsFor(rules, '[data-contrast="high"]'));
  });

  it('palette.ts stays in sync with tokens.css (real file)', () => {
    for (const theme of THEME_NAMES) {
      const layer = declarationsFor(rules, highSelector(theme));
      for (const token of HIGH_CONTRAST_TOKENS) {
        expect(HIGH_CONTRAST_PALETTE[theme][token], `${theme} ${token}`).toBe(tripletToHex(layer[`--pn-${token}`]!));
      }
      expect(HIGH_CONTRAST_SCRIM_OPACITY[theme], `${theme} scrim`).toBe(Number(layer['--pn-scrim-opacity']));
      // getPalette merges base and high: every key resolves to the CSS value of the combined theme.
      const combined = highTokens(theme);
      for (const [token, value] of Object.entries(getPalette(theme, 'high'))) {
        expect(value, `${theme} ${token}`).toBe(tripletToHex(combined[`--pn-${token}`]!));
      }
    }
  });
});

/** Hue of an RGB triplet in degrees. */
function hue(tokens: Record<string, string>, name: string): number {
  const [r, g, b] = tokens[`--pn-${name}`]!.split(' ').map((v) => Number(v) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

describe('high-contrast accents are the InkQuiet teal family (never the old blue)', () => {
  for (const theme of THEME_NAMES) {
    it(`${theme}: accent, link, accent-ink and the snackbar accent sit between 160 and 195 degrees`, () => {
      const tokens = highTokens(theme);
      for (const name of ['accent', 'link', 'accent-ink', 'accent-soft', 'inverse-accent']) {
        const h = hue(tokens, name);
        expect(h, `${theme} ${name}`).toBeGreaterThanOrEqual(160);
        expect(h, `${theme} ${name}`).toBeLessThanOrEqual(195);
      }
    });
  }

  it('the standard and high-contrast accents of a theme share a hue within 12 degrees', () => {
    for (const theme of THEME_NAMES) {
      const base = declarationsFor(rules, baseSelector(theme));
      const delta = Math.abs(hue(base, 'accent') - hue(highTokens(theme), 'accent'));
      expect(Math.min(delta, 360 - delta), theme).toBeLessThanOrEqual(12);
    }
  });
});

describe('WCAG contrast, theme x high contrast (computed from styles/tokens.css)', () => {
  for (const theme of THEME_NAMES) {
    describe(`${theme} + high contrast`, () => {
      const tokens = highTokens(theme);
      for (const pair of PAIRS) {
        it(`${pair.name} is at least ${pair.min}:1`, () => {
          const fg = hex(tokens, pair.fg);
          const bg = hex(tokens, pair.bg);
          const ratio = contrastRatio(fg, bg);
          expect(ratio, `${theme}: ${pair.name} ${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(pair.min);
        });
      }
    });
  }

  it('every theme x high-contrast combination keeps all text pairs at 7:1 or more', () => {
    const rows = THEME_NAMES.map((theme) => {
      const tokens = highTokens(theme);
      const ratios = (min: number) =>
        PAIRS.filter((p) => p.min === min).map((p) => contrastRatio(hex(tokens, p.fg), hex(tokens, p.bg)));
      const text = ratios(TEXT);
      const ui = PAIRS.filter((p) => p.min < TEXT).map((p) => contrastRatio(hex(tokens, p.fg), hex(tokens, p.bg)));
      return { theme, minText: Math.min(...text), minUi: Math.min(...ui) };
    });
    console.info(
      'High contrast minimum ratios (text >= 7, non-text >= 3):\n' +
        rows.map((r) => `  ${r.theme.padEnd(6)} text ${r.minText.toFixed(2)}  ui ${r.minUi.toFixed(2)}`).join('\n'),
    );
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.minText, row.theme).toBeGreaterThanOrEqual(7);
      expect(row.minUi, row.theme).toBeGreaterThanOrEqual(3);
    }
  });

  it('high contrast never lowers the standard ratio of text on page', () => {
    for (const theme of THEME_NAMES) {
      const standard = declarationsFor(rules, baseSelector(theme));
      const high = highTokens(theme);
      for (const fg of ['text', 'muted', 'link', 'danger']) {
        expect(contrastRatio(hex(high, fg), hex(high, 'page')), `${theme} ${fg}`).toBeGreaterThanOrEqual(
          contrastRatio(hex(standard, fg), hex(standard, 'page')),
        );
      }
    }
  });
});
