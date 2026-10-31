import { describe, expect, it } from 'vitest';
import { buildConsentPhrase, CONSENT_WORDS } from './phrases';

describe('buildConsentPhrase', () => {
  it('uses distinct words from the allow list', () => {
    let i = 0;
    const random = () => {
      i += 1;
      return (i * 0.17) % 1;
    };
    const phrase = buildConsentPhrase(4, random);
    const words = phrase.text.split(' ');
    expect(words).toHaveLength(4);
    for (const w of words) expect(CONSENT_WORDS).toContain(w);
    expect(new Set(words).size).toBe(4);
  });
});
