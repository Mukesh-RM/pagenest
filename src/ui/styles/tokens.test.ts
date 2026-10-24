// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { declarationsFor, listUiFiles, parseCss, readUiFile, tripletToHex, uiFileExists } from '../test/css';
import { COLOR_TOKENS, THEME_PALETTE } from '../theme/palette';
import { THEME_NAMES, THEME_PAGE_COLOR } from '../theme/themes';

const tokens = parseCss(readUiFile('styles/tokens.css'));
const components = parseCss(readUiFile('styles/components.css'));
const root = declarationsFor(tokens, ':root');

const px = (v: string | undefined): number => Number.parseFloat(v ?? 'NaN');
const ms = (v: string | undefined): number => Number.parseFloat(v ?? 'NaN');

describe('layout tokens', () => {
  it('spacing sits on the 4 px grid', () => {
    const spaces = Object.entries(root).filter(([k]) => k.startsWith('--pn-space-'));
    expect(spaces.length).toBeGreaterThanOrEqual(8);
    for (const [name, value] of spaces) expect(px(value) % 4, name).toBe(0);
    expect(root['--pn-space-1']).toBe('4px');
  });

  it('uses 12 px cards, 20 px sheets and full pills', () => {
    expect(root['--pn-radius-card']).toBe('12px');
    expect(root['--pn-radius-sheet']).toBe('20px');
    expect(px(root['--pn-radius-pill'])).toBeGreaterThanOrEqual(999);
  });

  it('screen margins are 16 px on phones and 24 px from the tablet breakpoint', () => {
    expect(root['--pn-margin']).toBe('16px');
    const tablet = declarationsFor(tokens, ':root', '@media (min-width: 768px)');
    expect(tablet['--pn-margin']).toBe('24px');
  });

  it('touch target token is 44 px', () => {
    expect(root['--pn-touch']).toBe('44px');
  });

  it('type scale is 12 / 14 / 16 / 20 / 28', () => {
    expect(['xs', 'sm', 'md', 'lg', 'xl'].map((s) => px(root[`--pn-text-${s}`]))).toEqual([12, 14, 16, 20, 28]);
  });
});

describe('motion tokens', () => {
  it('durations are between 150 and 250 ms with an ease-out curve', () => {
    for (const name of ['--pn-duration-fast', '--pn-duration-base', '--pn-duration-slow']) {
      const value = ms(root[name]);
      expect(value, name).toBeGreaterThanOrEqual(150);
      expect(value, name).toBeLessThanOrEqual(250);
    }
    expect(root['--pn-ease-out']).toBe('cubic-bezier(0, 0, 0.2, 1)');
  });

  it('collapses to 0 under prefers-reduced-motion and the data-reduce-motion override', () => {
    const media = declarationsFor(tokens, ':root:not([data-reduce-motion="false"])', '@media (prefers-reduced-motion: reduce)');
    const forced = declarationsFor(tokens, ':root[data-reduce-motion="true"]');
    for (const set of [media, forced]) {
      expect(ms(set['--pn-duration-fast'])).toBe(0);
      expect(ms(set['--pn-duration-base'])).toBe(0);
      expect(ms(set['--pn-duration-slow'])).toBe(0);
    }
  });

  it('component CSS only uses duration tokens for transitions (no hard-coded timings)', () => {
    const css = readUiFile('styles/components.css');
    const transitions = css.match(/transition:[^;]*;/g) ?? [];
    expect(transitions.length).toBeGreaterThan(5);
    for (const t of transitions) expect(t, t).not.toMatch(/\d+m?s\b(?![^(]*\))/);
  });

  it('the skeleton shimmer and snackbar entrance are switched off for reduced motion', () => {
    const css = readUiFile('styles/components.css');
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*\.pn-skeleton[\s\S]*animation: none/);
    expect(css).toMatch(/data-reduce-motion="true"\] \.pn-skeleton/);
  });
});

describe('touch targets (44 px)', () => {
  const interactive = [
    '.pn-btn',
    '.pn-chip',
    '.pn-card--interactive',
    '.pn-nav__item',
    '.pn-snackbar__action',
  ];
  for (const selector of interactive) {
    it(`${selector} has min-height and min-width of at least --pn-touch`, () => {
      const decl = declarationsFor(components, selector);
      expect(decl['min-height'], `${selector} min-height`).toMatch(/var\(--pn-touch\)/);
      expect(decl['min-width'] ?? decl['width'], `${selector} min-width`).toMatch(/var\(--pn-touch\)|100%/);
    });
  }

  it('the mini-player expand area is at least 44 px high and grows to fill the row', () => {
    const decl = declarationsFor(components, '.pn-miniplayer__expand');
    expect(decl['min-height']).toMatch(/var\(--pn-touch\)/);
    expect(decl['flex']).toMatch(/^1 /);
  });

  it('icon-only buttons are 44 px wide', () => {
    expect(declarationsFor(components, '.pn-btn--icon')['width']).toBe('var(--pn-touch)');
  });

  it('the large button is taller than 44 px, on the grid', () => {
    expect(declarationsFor(components, '.pn-btn--lg')['min-height']).toBe('calc(var(--pn-touch) + var(--pn-space-2))');
  });

  it('every interactive class also has a visible :focus-visible rule', () => {
    const css = readUiFile('styles/base.css');
    for (const selector of ['.pn-btn', '.pn-chip', '.pn-card--interactive', '.pn-nav__item', '.pn-snackbar__action']) {
      expect(css, selector).toContain(`${selector}:focus-visible`);
    }
    expect(css).toContain('outline: 2px solid rgb(var(--pn-focus-ring))');
  });
});

describe('responsive navigation', () => {
  it('the tab bar hides and the rail shows from 768 px', () => {
    const at = '@media (min-width: 768px)';
    expect(declarationsFor(components, '.pn-tabbar', at)['display']).toBe('none');
    expect(declarationsFor(components, '.pn-rail', at)['display']).toBe('flex');
    expect(declarationsFor(components, '.pn-rail')['display']).toBe('none');
    expect(declarationsFor(components, '.pn-tabbar')['display']).toBe('block');
  });
});

describe('theme palette (hex table used by code) stays in sync with the CSS', () => {
  for (const theme of THEME_NAMES) {
    it(`${theme}: every color token in palette.ts equals tokens.css, and nothing is missing`, () => {
      const decl = declarationsFor(tokens, `[data-theme="${theme}"]`);
      const cssColors = Object.keys(decl)
        .filter((k) => /^\d+ \d+ \d+$/.test(decl[k]!))
        .map((k) => k.replace('--pn-', ''))
        .sort();
      expect(cssColors).toEqual([...COLOR_TOKENS].sort());
      for (const token of COLOR_TOKENS) {
        expect(THEME_PALETTE[theme][token], `${theme} ${token}`).toBe(tripletToHex(decl[`--pn-${token}`]!));
      }
    });
  }

  it('THEME_PAGE_COLOR matches --pn-page in tokens.css', () => {
    for (const theme of THEME_NAMES) {
      const decl = declarationsFor(tokens, `[data-theme="${theme}"]`);
      expect(THEME_PAGE_COLOR[theme]).toBe(tripletToHex(decl['--pn-page']!));
    }
  });

  it('component CSS reads color tokens only through rgb(var(--pn-...))', () => {
    const colorNames = COLOR_TOKENS.join('|');
    const raw = new RegExp(`(?<!rgb\\()var\\(--pn-(${colorNames})\\)`, 'g');
    for (const file of ['styles/components.css', 'styles/base.css']) {
      expect(readUiFile(file).match(raw) ?? [], file).toEqual([]);
    }
  });

  it('uses the same variable names as the app shell for the shared colors', () => {
    const root = declarationsFor(tokens, '[data-theme="light"]');
    for (const name of ['page', 'surface', 'text', 'muted', 'accent', 'on-accent', 'line']) {
      expect(root[`--pn-${name}`], name).toMatch(/^\d+ \d+ \d+$/);
    }
  });
});

describe('self-hosted assets (no CDN, open licenses)', () => {
  it('every font file referenced by fonts.css exists and the OFL license is shipped', () => {
    const css = readUiFile('styles/fonts.css');
    const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]!);
    expect(urls.length).toBeGreaterThanOrEqual(2);
    for (const url of urls) {
      expect(url).not.toMatch(/^(https?:)?\/\//);
      expect(uiFileExists(`styles/${url}`), url).toBe(true);
    }
    expect(readUiFile('fonts/OFL-Inter.txt')).toContain('SIL Open Font License');
    expect(css).toContain('font-display: swap');
  });

  it('Lucide icons are vendored with their ISC license', () => {
    expect(readUiFile('icons/LICENSE-lucide.txt')).toContain('ISC License');
  });

  it('no stylesheet or source file loads anything over the network', () => {
    const files = listUiFiles().filter((f) => /\.(css|ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.startsWith('test/'));
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      const text = readUiFile(file);
      if (file.endsWith('.css')) {
        expect(text, file).not.toMatch(/url\(\s*["']?(https?:)?\/\//);
        expect(text, file).not.toMatch(/@import\s+(url\()?["']?(https?:)?\/\//);
      } else {
        expect(text, file).not.toMatch(/\bfetch\(|XMLHttpRequest|navigator\.sendBeacon|new WebSocket|\bimport\(["']https?:/);
      }
    }
  });
});
