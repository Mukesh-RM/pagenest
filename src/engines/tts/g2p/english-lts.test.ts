// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ltsEnglishWord } from './english-lts';

describe('ltsEnglishWord', () => {
  it('pronounces simple OOV with vowels', () => {
    const phones = ltsEnglishWord('NVIDIA');
    expect(phones.length).toBeGreaterThan(3);
    expect(phones).not.toContain('IY1'); // not letter-by-letter EY1 B IY1...
  });
});
