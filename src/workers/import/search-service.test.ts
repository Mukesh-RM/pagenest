import { describe, expect, it } from 'vitest';
import { SearchService, normalizeTerm, type SearchDoc } from './search-service';

const doc = (id: string, title: string, author = '', extra: Partial<SearchDoc> = {}): SearchDoc => ({ id, title, author, narrator: '', series: '', format: 'epub', ...extra });

describe('search', () => {
  const service = new SearchService();
  service.sync(
    [
      doc('1', 'Café Society', 'Woody Allen'),
      doc('2', 'The Straße Home', 'Anna Weiss'),
      doc('3', 'Moby-Dick; or, The Whale', 'Herman Melville', { format: 'epub' }),
      doc('4', 'Dune', 'Frank Herbert', { narrator: 'Scott Brick', series: 'Dune Chronicles', format: 'm4b' }),
      doc('5', 'Dune Messiah', 'Frank Herbert', { series: 'Dune Chronicles' }),
    ],
    [],
  );

  it('finds by title, author, narrator, series and format', () => {
    expect(service.search('whale')).toEqual(['3']);
    expect(service.search('melville')).toEqual(['3']);
    expect(service.search('scott brick')).toEqual(['4']);
    expect(service.search('chronicles').sort()).toEqual(['4', '5']);
    expect(service.search('m4b')).toEqual(['4']);
  });
  it('matches the start of a word and small typos, ignoring accents and case', () => {
    expect(service.search('mob')).toEqual(['3']);
    expect(service.search('melvile')).toEqual(['3']);
    expect(service.search('CAFE')).toEqual(['1']);
    expect(service.search('strasse')).toEqual(['2']);
  });
  it('needs every word to match, and ranks title hits first', () => {
    expect(service.search('dune herbert')[0]).toBe('4');
    expect(service.search('dune whale')).toEqual([]);
    expect(service.search('   ')).toEqual([]);
  });
  it('follows edits and removals', () => {
    service.sync([doc('3', 'Billy Budd', 'Herman Melville')], ['5']);
    expect(service.search('whale')).toEqual([]);
    expect(service.search('billy')).toEqual(['3']);
    expect(service.search('messiah')).toEqual([]);
    expect(service.size).toBe(4);
  });
  it('normalizes terms', () => {
    expect(normalizeTerm('Ünïcödé')).toBe('unicode');
  });
});
