import { describe, expect, it } from 'vitest';
import type { StoredBook } from '@/workers/import/protocol';
import { CARD_COLORS, cardColor, describeBook, formatDuration, initials, parsePrefs, selectBooks } from './model';

const book = (id: string, over: Partial<StoredBook> = {}): StoredBook => ({
  id, fingerprint: id, kind: 'ebook', format: 'epub', title: id, addedAt: 1, favorite: false, finished: false, ...over,
});

const books = [
  book('b', { title: 'Beta', author: 'Zed', addedAt: 2 }),
  book('a', { title: 'alpha 10', author: 'Amy', addedAt: 3 }),
  book('c', { title: 'alpha 2', addedAt: 1, kind: 'audio', format: 'm4b', lastOpenedAt: 50 }),
  book('d', { title: 'Delta', author: 'Amy', addedAt: 4, favorite: true, lastOpenedAt: 90 }),
  book('e', { title: 'Echo', addedAt: 5, finished: true }),
];
const none = { segment: 'all', chip: null, searchIds: null } as const;
const ids = (list: StoredBook[]): string[] => list.map((b) => b.id);
const percents = new Map([['b', 30], ['c', 10], ['d', 100]]);

describe('selectBooks', () => {
  it('sorts by recently added, opened, title (numbers in order) and author (missing last)', () => {
    expect(ids(selectBooks(books, percents, { ...none, sort: 'recent' }))).toEqual(['e', 'd', 'a', 'b', 'c']);
    expect(ids(selectBooks(books, percents, { ...none, sort: 'opened' }))).toEqual(['d', 'c', 'e', 'a', 'b']);
    expect(ids(selectBooks(books, percents, { ...none, sort: 'title' }))).toEqual(['c', 'a', 'b', 'd', 'e']);
    expect(ids(selectBooks(books, percents, { ...none, sort: 'author' }))).toEqual(['a', 'd', 'b', 'c', 'e']);
  });
  it('filters by segment and chip', () => {
    expect(ids(selectBooks(books, percents, { ...none, sort: 'title', segment: 'audio' }))).toEqual(['c']);
    expect(ids(selectBooks(books, percents, { ...none, sort: 'title', segment: 'books' }))).toEqual(['a', 'b', 'd', 'e']);
    expect(ids(selectBooks(books, percents, { ...none, sort: 'title', chip: 'reading' }))).toEqual(['b']);
    expect(ids(selectBooks(books, percents, { ...none, sort: 'title', chip: 'listening' }))).toEqual(['c']);
    expect(ids(selectBooks(books, percents, { ...none, sort: 'title', chip: 'finished' }))).toEqual(['d', 'e']);
    expect(ids(selectBooks(books, percents, { ...none, sort: 'title', chip: 'favorites' }))).toEqual(['d']);
  });
  it('keeps search order and still applies the other filters', () => {
    expect(ids(selectBooks(books, percents, { ...none, sort: 'title', searchIds: ['d', 'zzz', 'a', 'c'] }))).toEqual(['d', 'a', 'c']);
    expect(ids(selectBooks(books, percents, { ...none, sort: 'title', segment: 'audio', searchIds: ['d', 'a', 'c'] }))).toEqual(['c']);
  });
  it('limits to a shelf', () => {
    expect(ids(selectBooks(books, percents, { ...none, sort: 'title', only: new Set(['a', 'e']) }))).toEqual(['a', 'e']);
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
