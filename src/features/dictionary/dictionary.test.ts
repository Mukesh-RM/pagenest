import { describe, expect, it } from 'vitest';
import { loadWordnetPack, lookupWordnet } from '@/engines/dictionary/wordnet/lexicon';
import mini from './fixtures/wordnet-en-mini.json';

describe('wordnet lexicon', () => {
  const map = loadWordnetPack(JSON.stringify(mini));

  it('finds Alice fixture words', () => {
    const r = lookupWordnet(map, 'Wonder');
    expect(r.source).toBe('wordnet');
    expect(r.senses[0]?.glosses[0]).toMatch(/learn/i);
  });

  it('returns none for unknown words', () => {
    expect(lookupWordnet(map, 'xyzzy').source).toBe('none');
  });
});
