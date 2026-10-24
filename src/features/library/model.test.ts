import { describe, expect, it } from 'vitest';
import type { BookRecord as StoredBook } from '@/data/schema';
import { CARD_COLORS, cardColor, describeBook, formatDuration, initials, parsePrefs, toLibraryQuery } from './model';

const book = (id: string, over: Partial<StoredBook> = {}): StoredBook => ({
  id, fingerprint: id, kind: 'ebook', format: 'epub', title: id, addedAt: 1, favorite: false, finished: false, ...over,
});

describe('toLibraryQuery', () => {
  const base = { text: '', segment: 'all', chip: null, sort: 'title' } as const;
  it('asks only for what is set', () => {
    expect(toLibraryQuery(base)).toEqual({ segment: 'all', sort: 'title' });
    expect(toLibraryQuery({ ...base, chip: 'favorites', segment: 'audio' })).toEqual({ segment: 'audio', status: 'favorites', sort: 'title' });
  });
  it('ranks a search by relevance instead of the chosen sort, and trims it', () => {
    expect(toLibraryQuery({ ...base, text: '  zebra ' })).toEqual({ text: 'zebra', segment: 'all' });
  });
  it('keeps a shelf', () => {
    expect(toLibraryQuery({ ...base, collectionId: 'c1' })).toMatchObject({ collectionId: 'c1' });
  });
});

describe('helpers', () => {
  it('reads saved preferences safely', () => {
    expect(parsePrefs({ view: 'list', sort: 'title', segment: 'audio' })).toEqual({ view: 'list', sort: 'title', segment: 'audio' });
    expect(parsePrefs({ view: 'cube', sort: 7 })).toEqual({ view: 'grid', sort: 'recent', segment: 'all' });
    expect(parsePrefs(null)).toEqual({ view: 'grid', sort: 'recent', segment: 'all' });
  });
  it('describes a book for a screen reader', () => {
    expect(describeBook(book('x', { title: 'Dune', author: 'Frank Herbert', favorite: true }), 42)).toBe('Dune, by Frank Herbert, book, 42 percent done, favorite');
    expect(describeBook(book('x', { title: 'Tale', kind: 'audio' }), 100)).toBe('Tale, audiobook, finished');
  });
  it('formats durations', () => {
    expect(formatDuration(undefined)).toBeUndefined();
    expect(formatDuration(1800)).toBe('30 min');
    expect(formatDuration(3600 * 20 + 600)).toBe('20 h 10 min');
    expect(formatDuration(7200)).toBe('2 h');
  });
  it('gives a title the same card color every time, and initials from real words', () => {
    expect(cardColor('Moby Dick')).toEqual(cardColor('Moby Dick'));
    expect(initials('The Great Gatsby')).toBe('GG');
    expect(initials('日本語の本')).toBe('日');
    expect(initials('!!!')).toBe('?');
    expect(initials('one')).toBe('O');
  });
  it('title card colors keep white text at AA contrast (4.5:1)', () => {
    const lum = (hex: string): number => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
    };
    for (const { bg, fg } of CARD_COLORS) {
      const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a) as [number, number];
      expect((hi + 0.05) / (lo + 0.05), bg).toBeGreaterThanOrEqual(4.5);
    }
  });
});
