// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../test/contrast';
import { declarationsFor, parseCss, readUiFile, tripletToHex } from '../test/css';
import { THEME_NAMES, type ThemeName } from '../theme/themes';

/**
 * Contrast checks computed from the REAL token source (styles/tokens.css), so a changed color
 * cannot slip through. Text pairs need 4.5:1 (WCAG AA); non-text UI (focus ring, control
 * borders, filled accent boundary) needs 3:1.
 */

const rules = parseCss(readUiFile('styles/tokens.css'));

function themeTokens(theme: ThemeName): Record<string, string> {
  const selector = `[data-theme="${theme}"]`;
  return declarationsFor(rules, selector);
}

/** Hex value of a color token (tokens are stored as "r g b" triplets). */
function hex(tokens: Record<string, string>, name: string): string {
  const value = tokens[`--pn-${name}`];
  expect(value, `--pn-${name}`).toBeDefined();
  return tripletToHex(value!);
}

const TEXT = 4.5;
const UI = 3;

interface Pair {
  name: string;
  fg: string;
  bg: string;
  min: number;
}

const SURFACES = ['page', 'surface', 'surface-raised'] as const;

const PAIRS: Pair[] = [
  ...SURFACES.map((s) => ({ name: `text on ${s}`, fg: 'text', bg: s, min: TEXT })),
  ...SURFACES.map((s) => ({ name: `secondary text on ${s}`, fg: 'muted', bg: s, min: TEXT })),
  { name: 'button text on accent', fg: 'on-accent', bg: 'accent', min: TEXT },
  ...SURFACES.map((s) => ({ name: `link on ${s}`, fg: 'link', bg: s, min: TEXT })),
  ...SURFACES.map((s) => ({ name: `danger text on ${s}`, fg: 'danger', bg: s, min: TEXT })),
  { name: 'snackbar text', fg: 'inverse-text', bg: 'inverse-surface', min: TEXT },
  { name: 'snackbar Undo action', fg: 'inverse-accent', bg: 'inverse-surface', min: TEXT },
  ...SURFACES.map((s) => ({ name: `focus ring on ${s}`, fg: 'focus-ring', bg: s, min: UI })),
  ...SURFACES.map((s) => ({ name: `control border on ${s}`, fg: 'border-strong', bg: s, min: UI })),
  ...SURFACES.map((s) => ({ name: `accent fill vs ${s}`, fg: 'accent', bg: s, min: UI })),
  { name: 'accent as text on page (selected nav, accent icons)', fg: 'accent', bg: 'page', min: TEXT },
];

describe('theme tokens', () => {
  it('defines all four themes with an identical set of tokens', () => {
    const reference = Object.keys(themeTokens('light')).sort();
    expect(reference.length).toBeGreaterThan(15);
    for (const theme of THEME_NAMES) {
      expect(Object.keys(themeTokens(theme)).sort(), `${theme} token set`).toEqual(reference);
    }
  });

  it('uses Light as the default when no data-theme is set', () => {
    const root = declarationsFor(rules, ':root');
    const light = themeTokens('light');
    for (const key of ['--pn-page', '--pn-text', '--pn-accent', '--pn-muted', '--pn-on-accent']) {
      expect(root[key], key).toBe(light[key]);
    }
  });

  it('uses the page, text and accent colors from blueprint 5.2', () => {
    const expected: Record<ThemeName, [string, string, string]> = {
      light: ['#fafaf7', '#1c1b19', '#3e5bdb'],
      sepia: ['#f4ecd8', '#3b2f23', '#a0522d'],
      dark: ['#17181c', '#e4e2dc', '#8fa6ff'],
      black: ['#000000', '#cfcdc7', '#8fa6ff'],
    };
    for (const theme of THEME_NAMES) {
      const t = themeTokens(theme);
      expect([hex(t, 'page'), hex(t, 'text'), hex(t, 'accent')], theme).toEqual(expected[theme]);
    }
  });
});

describe('WCAG contrast per theme (computed from styles/tokens.css)', () => {
  for (const theme of THEME_NAMES) {
    describe(theme, () => {
      const tokens = themeTokens(theme);
      for (const pair of PAIRS) {
        it(`${pair.name} is at least ${pair.min}:1`, () => {
          const fg = hex(tokens, pair.fg);
          const bg = hex(tokens, pair.bg);
          const ratio = contrastRatio(fg!, bg!);
          expect(ratio, `${theme}: ${pair.name} ${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(pair.min);
        });
      }
    });
  }

  it('reports the minimum ratio per theme', () => {
    const table = THEME_NAMES.map((theme) => {
      const tokens = themeTokens(theme);
      const text = PAIRS.filter((p) => p.min === TEXT).map((p) => contrastRatio(hex(tokens, p.fg), hex(tokens, p.bg)));
      const ui = PAIRS.filter((p) => p.min === UI).map((p) => contrastRatio(hex(tokens, p.fg), hex(tokens, p.bg)));
      return { theme, minText: Math.min(...text).toFixed(2), minUi: Math.min(...ui).toFixed(2) };
    });
    console.info('Minimum contrast ratios (text >= 4.5, non-text >= 3):\n' + table.map((r) => `  ${r.theme.padEnd(6)} text ${r.minText}  ui ${r.minUi}`).join('\n'));
    for (const row of table) {
      expect(Number(row.minText)).toBeGreaterThanOrEqual(TEXT);
      expect(Number(row.minUi)).toBeGreaterThanOrEqual(UI);
    }
  });

  it('the contrast helper matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });
});
