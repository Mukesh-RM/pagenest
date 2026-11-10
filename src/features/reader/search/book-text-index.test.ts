import { describe, expect, it } from 'vitest';
import MiniSearch from 'minisearch';
import { findMatches, excerptAround } from '../core/search';

describe('book text index chunks', () => {
  it('finds matches inside a section chunk', () => {
    const text = 'Alice was beginning to get very tired of sitting by her sister on the bank.';
    const matches = findMatches(text, 'tired');
    expect(matches.length).toBeGreaterThan(0);
    const ex = excerptAround(text, matches[0]!);
    expect(ex.excerpt.toLowerCase()).toContain('tired');
  });

  it('MiniSearch ranks terms in chunked documents', () => {
    const mini = new MiniSearch({ fields: ['text'], storeFields: ['text'] });
    mini.addAll([
      { id: 'a', text: 'quiet night on the river' },
      { id: 'b', text: 'busy market at noon' },
    ]);
    const hits = mini.search('river night');
    expect(hits[0]?.id).toBe('a');
  });
});
