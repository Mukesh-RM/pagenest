import '../test/setup';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { declarationsFor, parseCss, readUiFile, tripletToHex } from '../test/css';
import { contrastRatio, parseHex } from '../utils/wcag';
import { COLOR_TOKENS } from './palette';
import {
  DEFAULT_CUSTOM_THEME,
  customContrastPairs,
  customThemeStyle,
  normalizeHex,
  parseCustomTheme,
  resolveCustomTheme,
} from './custom';
import { ThemeProvider, ThemeScope, ThemedPortal, useTheme } from './ThemeProvider';

/** Small seeded generator so a failure is reproducible. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const hex = (n: number) => '#' + Math.floor(n * 0xffffff).toString(16).padStart(6, '0');

describe('custom theme: validation', () => {
  it('normalizes short and upper-case hex and rejects the rest', () => {
    expect(normalizeHex('#ABC', '#000000')).toBe('#aabbcc');
    expect(normalizeHex('1E2230', '#000000')).toBe('#1e2230');
    for (const bad of ['', 'red', '#12', '#12345', '#gggggg', 42, null, undefined, '#1e2230 ; x']) {
      expect(normalizeHex(bad, '#fallback')).toBe('#fallback');
    }
  });

  it('parseCustomTheme accepts a full object only', () => {
    expect(parseCustomTheme({ page: '#fff', text: '#000', accent: '#f00' })).toEqual({ page: '#ffffff', text: '#000000', accent: '#ff0000' });
    expect(parseCustomTheme({ page: '#fff' })).toBeUndefined();
    expect(parseCustomTheme('x')).toBeUndefined();
    expect(parseCustomTheme(null)).toBeUndefined();
  });

  it('invalid input falls back to the defaults and never throws', () => {
    const r = resolveCustomTheme({ page: 'nope', text: 7 as unknown as string, accent: '' });
    expect(r.input).toEqual(DEFAULT_CUSTOM_THEME);
  });
});

describe('custom theme: AA contrast', () => {
  const fails = (input: { page: string; text: string; accent: string }): string[] => {
    const r = resolveCustomTheme(input);
    return customContrastPairs(r)
      .filter((p) => contrastRatio(p.fg, p.bg) < p.min - 0.001)
      .map((p) => `${JSON.stringify(input)} ${p.name}: ${contrastRatio(p.fg, p.bg).toFixed(2)} < ${p.min}`);
  };

  it('the default is AA and untouched', () => {
    expect(fails(DEFAULT_CUSTOM_THEME)).toEqual([]);
    expect(resolveCustomTheme(DEFAULT_CUSTOM_THEME).adjusted).toEqual({ text: false, accent: false });
  });

  it('keeps text 7:1 on the page when the page color allows it', () => {
    const r = resolveCustomTheme({ page: '#101820', text: '#556677', accent: '#ff00aa' });
    expect(contrastRatio(r.palette.text, r.palette.page)).toBeGreaterThanOrEqual(7);
    expect(r.adjusted.text).toBe(true);
  });

  it('every hostile pair is corrected: same colors, mid grays, neon on neon', () => {
    const hostile = [
      ['#808080', '#808080', '#808080'],
      ['#777777', '#7a7a7a', '#7c7c7c'],
      ['#ffffff', '#ffffff', '#ffffff'],
      ['#000000', '#000000', '#000000'],
      ['#ff00ff', '#00ff00', '#0000ff'],
      ['#7f7f7f', '#000000', '#ffffff'],
      ['#767676', '#767676', '#ff0000'],
      ['#ffff00', '#ffff00', '#ffff00'],
    ];
    for (const [page, text, accent] of hostile) expect(fails({ page: page!, text: text!, accent: accent! }), `${page} ${text} ${accent}`).toEqual([]);
  });

  // Fixed seeds, so a failure reproduces on every machine; the seed is part of the failure message.
  for (const seed of [7, 1234, 987654321]) {
    it(`holds for 3000 random colors (seed ${seed})`, () => {
      const next = rng(seed);
      const all: string[] = [];
      for (let i = 0; i < 3000; i += 1) all.push(...fails({ page: hex(next()), text: hex(next()), accent: hex(next()) }));
      expect(all.slice(0, 5), `seed ${seed}`).toEqual([]);
    });
  }

  it('holds for every gray page against grays and saturated colors (exhaustive over steps of 5)', () => {
    const all: string[] = [];
    for (let v = 0; v <= 255; v += 5) {
      const g = '#' + v.toString(16).padStart(2, '0').repeat(3);
      for (let t = 0; t <= 255; t += 51) {
        const text = '#' + t.toString(16).padStart(2, '0').repeat(3);
        for (const accent of ['#808080', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', g]) all.push(...fails({ page: g, text, accent }));
      }
    }
    expect(all.slice(0, 5)).toEqual([]);
  });

  it('holds across a grid of mid-tone pages, the hardest case', () => {
    const all: string[] = [];
    for (let v = 0x60; v <= 0xa0; v += 8) {
      const page = '#' + v.toString(16).repeat(3);
      for (const text of ['#000000', '#ffffff', page, '#336699']) all.push(...fails({ page, text, accent: '#3366ff' }));
    }
    expect(all.slice(0, 5)).toEqual([]);
  });
});

describe('custom theme: high contrast', () => {
  const failsHigh = (input: { page: string; text: string; accent: string }): string[] => {
    const r = resolveCustomTheme(input, 'high');
    const out = customContrastPairs(r)
      .filter((p) => contrastRatio(p.fg, p.bg) < p.min)
      .map((p) => `${JSON.stringify(input)} ${p.name}: ${contrastRatio(p.fg, p.bg).toFixed(3)} < ${p.min}`);
    // AA is never given up: even the lowest target stays at 4.5 or better.
    if (r.textTarget < 4.5) out.push(`${JSON.stringify(input)} textTarget ${r.textTarget}`);
    // 7:1 for text whenever the page can give black or white 7:1.
    const best = Math.max(contrastRatio('#ffffff', r.palette.page), contrastRatio('#000000', r.palette.page));
    if (best >= 7 && r.textTarget < 7) out.push(`${JSON.stringify(input)} should target 7, got ${r.textTarget}`);
    return out;
  };

  it('the default theme reaches 7:1 for every text pair in high contrast', () => {
    const r = resolveCustomTheme(DEFAULT_CUSTOM_THEME, 'high');
    expect(r.textTarget).toBe(7);
    for (const p of customContrastPairs(r)) expect(contrastRatio(p.fg, p.bg), p.name).toBeGreaterThanOrEqual(p.min);
    expect(r.level).toBe('high');
  });

  it('standard resolution is unchanged by the new level argument', () => {
    expect(resolveCustomTheme(DEFAULT_CUSTOM_THEME).palette).toEqual(resolveCustomTheme(DEFAULT_CUSTOM_THEME, 'standard').palette);
    expect(resolveCustomTheme(DEFAULT_CUSTOM_THEME).textTarget).toBe(4.5);
  });

  for (const seed of [11, 2025, 424242]) {
    it(`holds for 3000 random colors (seed ${seed})`, () => {
      const next = rng(seed);
      const all: string[] = [];
      for (let i = 0; i < 3000; i += 1) all.push(...failsHigh({ page: hex(next()), text: hex(next()), accent: hex(next()) }));
      expect(all.slice(0, 5), `seed ${seed}`).toEqual([]);
    });
  }

  it('holds for pure and mid-tone pages against hostile text and accent colors', () => {
    const pages = ['#000000', '#ffffff', '#808080', '#767676', '#595959', '#1e2230', '#f4ecd8', '#ff00ff', '#00ff00'];
    const inks = ['#000000', '#ffffff', '#808080', '#ff00ff', '#00ffff', '#ffff00', '#0000ff'];
    const all: string[] = [];
    for (const page of pages) for (const text of inks) for (const accent of inks) all.push(...failsHigh({ page, text, accent }));
    expect(all.slice(0, 5)).toEqual([]);
  });

  it('writes the stronger scrim and keeps the standard one otherwise', () => {
    const hi = customThemeStyle(resolveCustomTheme(DEFAULT_CUSTOM_THEME, 'high')) as Record<string, string>;
    const std = customThemeStyle(resolveCustomTheme(DEFAULT_CUSTOM_THEME)) as Record<string, string>;
    expect(Number(hi['--pn-scrim-opacity'])).toBeGreaterThan(Number(std['--pn-scrim-opacity']));
  });

  it('the provider recomputes the Custom palette when the contrast setting changes', () => {
    function Probe() {
      const { custom, contrast } = useTheme();
      return <p data-testid="p">{`${contrast}:${custom?.textTarget}`}</p>;
    }
    const { rerender } = render(
      <ThemeProvider mode="custom" contrastMode="standard">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('p')).toHaveTextContent('standard:4.5');
    rerender(
      <ThemeProvider mode="custom" contrastMode="high">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('p')).toHaveTextContent('high:7');
    expect(document.documentElement.getAttribute('data-contrast')).toBe('high');
    expect(document.documentElement.getAttribute('data-theme')).toBe('custom');
  });
});

describe('custom theme: tokens', () => {
  it('the data-theme="custom" block in tokens.css matches the resolved default', () => {
    const decl = declarationsFor(parseCss(readUiFile('styles/tokens.css')), '[data-theme="custom"]');
    const r = resolveCustomTheme(DEFAULT_CUSTOM_THEME);
    for (const token of COLOR_TOKENS) expect(tripletToHex(decl[`--pn-${token}`]!), token).toBe(r.palette[token]);
    expect(decl['color-scheme']).toBe(r.scheme);
  });

  it('writes every color token as an RGB triplet', () => {
    const style = customThemeStyle(resolveCustomTheme(DEFAULT_CUSTOM_THEME)) as Record<string, string>;
    for (const token of COLOR_TOKENS) expect(style[`--pn-${token}`]).toBe(parseHex(resolveCustomTheme(DEFAULT_CUSTOM_THEME).palette[token]).join(' '));
  });
});

describe('custom theme: provider, scope and portal', () => {
  function Probe() {
    const { mode, theme, custom } = useTheme();
    return <p data-testid="probe">{`${mode}/${theme}/${custom ? custom.palette.page : '-'}`}</p>;
  }

  it('applies data-theme="custom" and the inline colors on the root, and removes them again', () => {
    const { rerender, unmount } = render(
      <ThemeProvider mode="custom" customTheme={{ page: '#fafafa', text: '#111111', accent: '#7733cc' }}>
        <Probe />
      </ThemeProvider>,
    );
    const root = document.documentElement;
    expect(root).toHaveAttribute('data-theme', 'custom');
    expect(root.style.getPropertyValue('--pn-page')).toBe('250 250 250');
    expect(root.style.getPropertyValue('color-scheme')).toBe('light');
    expect(screen.getByTestId('probe')).toHaveTextContent('custom/light/#fafafa');
    rerender(
      <ThemeProvider mode="dark">
        <Probe />
      </ThemeProvider>,
    );
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(root.style.getPropertyValue('--pn-page')).toBe('');
    unmount();
  });

  it('a scope and its portals carry the custom colors', () => {
    render(
      <ThemeScope theme="custom" custom={{ page: '#101010', text: '#f0f0f0', accent: '#66ccff' }}>
        <ThemedPortal>
          <p>sheet</p>
        </ThemedPortal>
      </ThemeScope>,
    );
    const portal = screen.getByText('sheet').parentElement!;
    expect(portal).toHaveAttribute('data-theme', 'custom');
    expect(portal.style.getPropertyValue('--pn-page')).toBe('16 16 16');
  });
});
