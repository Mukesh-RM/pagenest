import { describe, expect, it } from 'vitest';
import { primaryWord } from './word';

describe('primaryWord', () => {
  it('takes the first token and strips edge punctuation', () => {
    expect(primaryWord('Wonder,')).toBe('Wonder');
    expect(primaryWord('the rabbit-hole')).toBe('the');
    expect(primaryWord('  curious  ')).toBe('curious');
  });
});
