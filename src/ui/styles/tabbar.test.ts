import { describe, expect, it } from 'vitest';
import { declarationsFor, parseCss, readUiFile } from '../test/css';

const rules = parseCss(readUiFile('styles/components.css'));
const tokens = readUiFile('styles/tokens.css');
const token = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(tokens)![1]!.trim();

const BASE_PX = 16;
const remPx = (value: string, root: number) => {
  expect(value).toMatch(/^[\d.]+rem$/);
  return parseFloat(value) * root;
};

describe('tab bar labels at 200% text', () => {
  const item = declarationsFor(rules, '.pn-tabbar .pn-nav__item');
  const label = declarationsFor(rules, '.pn-tabbar .pn-nav__label');

  it('are the full text-xs token, with no px or min() cap, so 200% is exactly 2x the base size', () => {
    expect(item['font-size']).toBe('var(--pn-text-xs)');
    const xs = token('--pn-text-xs');
    expect(remPx(xs, 2 * BASE_PX)).toBe(2 * remPx(xs, BASE_PX));
    expect(remPx(xs, 2 * BASE_PX)).toBe(24);
    expect(readUiFile('styles/components.css')).not.toMatch(/min\(var\(--pn-text-xs\),\s*\d+px\)/);
  });

  it('are never cut: no overflow hidden, no ellipsis, no forced single line', () => {
    expect(label['overflow']).toBe('visible');
    expect(label['text-overflow']).toBe('clip');
    expect(label['white-space']).toBe('normal');
    expect(label['overflow-wrap']).toBe('anywhere');
  });

  it('keep 44 px targets and a bar that only has a minimum height, plus the safe-area inset', () => {
    expect(token('--pn-touch')).toBe('44px');
    expect(declarationsFor(rules, '.pn-nav__item')['min-height']).toBe('var(--pn-touch)');
    expect(declarationsFor(rules, '.pn-tabbar .pn-nav__list')['min-height']).toBe('var(--pn-tabbar-height)');
    for (const rule of rules.filter((r) => /pn-tabbar/.test(r.selector))) {
      expect(Object.keys(rule.declarations), rule.selector).not.toContain('height');
    }
    expect(declarationsFor(rules, '.pn-tabbar')['padding-bottom']).toContain('env(safe-area-inset-bottom');
  });

  it('go to two rows of two when four tabs cannot fit, decided in rem so it follows the text size', () => {
    expect(declarationsFor(rules, '.pn-tabbar')['container-type']).toBe('inline-size');
    const at = rules.find((r) => r.selector === '.pn-tabbar .pn-nav__list' && r.at.startsWith('@container'))!;
    expect(at.declarations['flex-wrap']).toBe('wrap');
    expect(at.declarations['min-height']).toBe('0');
    const cell = rules.find((r) => r.selector === '.pn-tabbar .pn-nav__list > li' && r.at.startsWith('@container'))!;
    expect(cell.declarations['flex']).toBe('1 1 50%');
    const limitRem = parseFloat(/max-width:\s*([\d.]+)rem/.exec(at.at)![1]!);
    // "Collections" measures 67 px at 12 px in a real browser (4.2 rem at text-xs); a tab also has 2 x 4 px of padding.
    // Four in a row need 4 x (4.2 rem + 8 px) at every text size the app allows (root 14 to 32 px).
    for (const root of [14, 16, 20, 24, 32]) expect(limitRem * root, `root ${root}px`).toBeGreaterThanOrEqual(4 * (4.2 * root + 8));
    const oneRow = (screenPx: number, rootPx: number) => screenPx > limitRem * rootPx;
    expect(oneRow(360, 16)).toBe(true);
    expect(oneRow(430, 16)).toBe(true);
    expect(oneRow(360, 32)).toBe(false);
    expect(oneRow(430, 32)).toBe(false);
    expect(oneRow(360, 20)).toBe(false);
  });

  it('even two rows fit: the longest label at 200% is narrower than half of a 360 px screen', () => {
    // "Collections" is 5.6 em wide in Inter semi-bold (measured: 67 px at 12 px).
    const longest = 5.6 * remPx(token('--pn-text-xs'), 2 * BASE_PX);
    expect(longest).toBeLessThan(360 / 2);
  });
});
