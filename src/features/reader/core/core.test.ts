import { describe, expect, it } from 'vitest';
import type { ReaderPosition, TocItem } from '@/engines/reader/types';
import { DEFAULT_APPEARANCE, normalizeAppearance, reflowCss, textContrast, themeColors, THEME_ORDER } from './appearance';
import { contrast } from './color';
import { chapterNumber, welcomeBackFor } from './welcome';
import { compareRanges, makeRange, rangesOverlap, reflowAt, sectionsOfRange, singleSection } from './ranges';
import { excerptAround, findMatches, searchText } from './search';
import { currentTocIndex } from './toc';
import { findFirstVisibleOffset, firstVisibleOffset, offsetsOfRange, rangeFromOffsets, sectionText, textNodes } from './text-offsets';
import { fontFaceCss, fontForFamily, READING_FONTS } from './fonts';

function html(body: string): Document {
  return new DOMParser().parseFromString(`<!doctype html><html><head><style>p{color:red}</style></head><body>${body}</body></html>`, 'text/html');
}

describe('appearance', () => {
  it('keeps text readable (WCAG AA, 4.5:1) on every built-in theme', () => {
    for (const theme of THEME_ORDER.filter((t) => t !== 'custom')) {
      expect(textContrast({ ...DEFAULT_APPEARANCE, theme }), theme).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps links readable on every built-in theme', () => {
    for (const theme of THEME_ORDER.filter((t) => t !== 'custom')) {
      const c = themeColors({ ...DEFAULT_APPEARANCE, theme });
      expect(contrast(c.accent, c.page), `${theme} link`).toBeGreaterThanOrEqual(3);
    }
  });

  it('clamps and repairs a bad saved appearance without throwing', () => {
    const a = normalizeAppearance({ fontSizePx: 900, lineHeight: -3, theme: 'neon', margins: 'huge', custom: { page: 'url(javascript:1)', text: '#000', accent: '#00f' } });
    expect(a.fontSizePx).toBe(40);
    expect(a.lineHeight).toBe(1.2);
    expect(a.theme).toBe(DEFAULT_APPEARANCE.theme);
    expect(a.margins).toBe(DEFAULT_APPEARANCE.margins);
    expect(a.custom).toBeUndefined();
  });

  it('writes page styles that carry the chosen look, and the page color the paginator reads', () => {
    const css = reflowCss({ ...DEFAULT_APPEARANCE, theme: 'sepia', fontSizePx: 22, lineHeight: 1.85 });
    expect(css).toContain('font-size:22px');
    expect(css).toContain('line-height:1.85');
    expect(css).toContain(`--theme-bg-color:${themeColors({ ...DEFAULT_APPEARANCE, theme: 'sepia' }).page}`);
  });
});

describe('fonts', () => {
  it('finds a font from a CSS family list and falls back to the default', () => {
    expect(fontForFamily("Inter, system-ui, sans-serif").id).toBe('inter');
    expect(fontForFamily('Comic Neue').id).toBe(READING_FONTS[0]?.id);
  });

  it('declares each face with an absolute-able URL under a font-display swap', () => {
    const css = fontFaceCss(fontForFamily('Literata'));
    expect(css).toContain('font-display:swap');
    expect(css).toMatch(/font-family:Literata/);
  });

  it('declares nothing for device fonts', () => {
    expect(fontFaceCss(fontForFamily('Georgia'))).toBe('');
  });
});

describe('text offsets', () => {
  it('counts text the same way when saving and when restoring, skipping style and script', () => {
    const doc = html('<h1>Title</h1><p>One <b>two</b> three.</p><script>var x=1</script><p>Four</p>');
    expect(sectionText(doc)).toBe('TitleOne two three.Four');
    expect(textNodes(doc).map((n) => n.data)).toEqual(['Title', 'One ', 'two', ' three.', 'Four']);
  });

  it('round-trips an offset through a DOM range', () => {
    const doc = html('<p>Hello <i>brave</i> new world</p>');
    const range = rangeFromOffsets(doc, 8, 16);
    expect(range.toString()).toBe('ave new ');
    expect(offsetsOfRange(doc, range)).toEqual({ start: 8, end: 16 });
  });

  it('clamps offsets past the end', () => {
    const doc = html('<p>Short</p>');
    expect(rangeFromOffsets(doc, 3, 999).toString()).toBe('rt');
    expect(rangeFromOffsets(doc, 500, 999).toString()).toBe('');
  });

  it('keeps the range start when nothing has been laid out (no layout engine)', () => {
    const doc = html('<p>Some text that is not laid out here.</p>');
    const range = rangeFromOffsets(doc, 5, 9);
    expect(firstVisibleOffset(doc, range, 0, 100)).toBe(5);
    expect(findFirstVisibleOffset(doc, 0, 0, 100)).toBeUndefined();
  });
});

describe('ranges', () => {
  it('orders, overlaps and splits ranges across sections', () => {
    const a = makeRange(2, 10, 20);
    const b = makeRange(2, 15, 30);
    const c = makeRange(3, 0, 5);
    expect(compareRanges(a, b)).toBeLessThan(0);
    expect(compareRanges(c, a)).toBeGreaterThan(0);
    expect(rangesOverlap(a, b)).toBe(true);
    expect(rangesOverlap(a, c)).toBe(false);
    expect(rangesOverlap(makeRange(1, 0, 5), makeRange(1, 5, 9))).toBe(false);
    expect(singleSection(a)).toEqual({ section: 2, start: 10, end: 20 });
    expect(singleSection({ start: reflowAt(1, 5), end: reflowAt(3, 2) })).toBeUndefined();
    expect(sectionsOfRange({ start: reflowAt(1, 5), end: reflowAt(3, 2) })).toEqual([
      { section: 1, start: 5, end: Number.POSITIVE_INFINITY },
      { section: 2, start: 0, end: Number.POSITIVE_INFINITY },
      { section: 3, start: 0, end: 2 },
    ]);
  });

  it('swaps a backwards range into order', () => {
    expect(makeRange(0, 9, 3)).toEqual({ start: reflowAt(0, 3), end: reflowAt(0, 9) });
  });
});

describe('search', () => {
  it('finds matches ignoring case and accents, and reports offsets in the original text', () => {
    const text = 'Café au lait, café noir.';
    expect(findMatches(text, 'cafe')).toEqual([
      { start: 0, end: 4 },
      { start: 14, end: 18 },
    ]);
  });

  it('can match whole words only', () => {
    expect(findMatches('cat concatenate cat', 'cat', { wholeWords: true })).toHaveLength(2);
    expect(findMatches('cat concatenate cat', 'cat')).toHaveLength(3);
  });

  it('matches nothing for a blank query', () => {
    expect(findMatches('anything', '   ')).toEqual([]);
  });

  it('gives short excerpts with the match inside them', () => {
    const text = `${'x'.repeat(100)} needle ${'y'.repeat(100)}`;
    const [m] = findMatches(text, 'needle');
    const e = excerptAround(text, m as { start: number; end: number });
    expect(e.excerpt.slice(e.matchStart, e.matchEnd)).toBe('needle');
    expect(e.excerpt.startsWith('…')).toBe(true);
    expect(e.excerpt.endsWith('…')).toBe(true);
  });

  it('turns matches into hits with locators', () => {
    const hits = searchText('Peter ran. Peter hid.', 'peter', (o) => reflowAt(4, o));
    expect(hits.map((h) => h.range.start)).toEqual([reflowAt(4, 0), reflowAt(4, 11)]);
  });
});

describe('contents and welcome-back', () => {
  const item = (title: string, section: number): { item: TocItem } => ({ item: { title, locator: reflowAt(section, 0) } });
  const at = (section: number, textOffset = 0, chapterTitle?: string): ReaderPosition => ({ locator: reflowAt(section, textOffset), percent: 10, ...(chapterTitle ? { chapterTitle } : {}) });

  it('marks the last chapter that starts at or before the position', () => {
    const flat = [item('One', 0), item('Two', 3), item('Three', 7)];
    expect(currentTocIndex(flat, at(0))).toBe(0);
    expect(currentTocIndex(flat, at(5, 40))).toBe(1);
    expect(currentTocIndex(flat, at(9))).toBe(2);
    expect(currentTocIndex(flat, undefined)).toBe(-1);
  });

  it('numbers chapters from where they start', () => {
    expect(chapterNumber([0, 0.2, 0.5], 0.3)).toBe(2);
    expect(chapterNumber([0.1, 0.5], 0.05)).toBe(0);
  });

  it('welcomes back only a book that was really started', () => {
    const doc = { layout: 'reflow', chapterTicks: () => [0, 0.2, 0.5] } as const;
    expect(welcomeBackFor(doc, at(0), 0)).toBeUndefined();
    expect(welcomeBackFor(doc, at(2, 0, 'The Storm'), 30)).toEqual({ headline: 'Welcome back, chapter 2', detail: 'The Storm' });
  });
});
