import { describe, expect, it } from 'vitest';
import { consentPhraseMatches, normalizeSpokenText } from './verify';

describe('consentPhraseMatches', () => {
  it('matches when every word appears in order', () => {
    const expected = 'amber river zenith';
    expect(consentPhraseMatches(expected, 'I said amber then river and zenith today')).toBe(true);
  });

  it('rejects missing words', () => {
    expect(consentPhraseMatches('amber river zenith', 'amber zenith')).toBe(false);
  });

  it('normalizes punctuation and case', () => {
    expect(normalizeSpokenText(' Hello, World! ')).toBe('hello world');
  });
});
