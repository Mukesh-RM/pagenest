import { describe, expect, it } from 'vitest';
import { FILTERS, SORT_LABELS, formatDuration, formatTag, isFinished, parsePrefs, toLibraryQuery } from './model';

describe('toLibraryQuery', () => {
  const base = { text: '', filter: 'all', sort: 'title', segment: 'all' } as const;
  it('asks only for what is set', () => {
    expect(toLibraryQuery(base)).toEqual({ sort: 'title' });
    expect(toLibraryQuery({ ...base, filter: 'favorites' })).toEqual({ status: 'favorites', sort: 'title' });
    expect(toLibraryQuery({ ...base, filter: 'reading' })).toEqual({ status: 'reading', sort: 'title' });
  });
  it('ranks a search by relevance instead of the chosen sort, and trims it', () => {
    expect(toLibraryQuery({ ...base, text: '  zebra ' })).toEqual({ text: 'zebra' });
  });
  it('limits by segment (All / Books / Audio)', () => {
    expect(toLibraryQuery({ ...base, segment: 'audio' })).toEqual({ segment: 'audio', sort: 'title' });
    expect(toLibraryQuery({ ...base, segment: 'books' })).toEqual({ segment: 'books', sort: 'title' });
  });
  it('keeps a shelf', () => {
    expect(toLibraryQuery({ ...base, collectionId: 'c1' })).toMatchObject({ collectionId: 'c1' });
  });
});

describe('the words on the screen', () => {
  it('uses the design system\'s sort words', () => {
    expect(Object.values(SORT_LABELS)).toEqual(['Recently opened', 'Recently added', 'Title', 'Author']);
  });
  it('has the design system\'s four filters and Favorites, each once', () => {
    expect(FILTERS.map((f) => f.label)).toEqual(['All', 'Favorites', 'Reading', 'Listening', 'Finished']);
    expect(new Set(FILTERS.map((f) => f.id)).size).toBe(FILTERS.length);
  });
});

describe('helpers', () => {
  it('reads saved preferences safely, ignoring old ones it no longer has', () => {
    expect(parsePrefs({ view: 'list', sort: 'title', segment: 'audio' })).toEqual({ view: 'list', sort: 'title', segment: 'audio' });
    expect(parsePrefs({ view: 'cube', sort: 7 })).toEqual({ view: 'grid', sort: 'recent', segment: 'all' });
    expect(parsePrefs(null)).toEqual({ view: 'grid', sort: 'recent', segment: 'all' });
  });
  it('knows a finished book by its flag or by reaching the end', () => {
    expect(isFinished({ finished: true }, 0)).toBe(true);
    expect(isFinished({ finished: false }, 100)).toBe(true);
    expect(isFinished({ finished: false }, 99)).toBe(false);
  });
  it('names the format and formats durations', () => {
    expect(formatTag({ format: 'm4b' })).toBe('M4B');
    expect(formatDuration(undefined)).toBeUndefined();
    expect(formatDuration(1800)).toBe('30 min');
    expect(formatDuration(3600 * 20 + 600)).toBe('20 h 10 min');
    expect(formatDuration(7200)).toBe('2 h');
  });
});
