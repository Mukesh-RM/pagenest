// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveHeteronymPhones } from './heteronyms';

const CASES: readonly { sentence: string; word: string; index: number; expected: string }[] = [
  { sentence: 'I will read the book.', word: 'read', index: 2, expected: 'R IY1 D' },
  { sentence: 'I read the book yesterday.', word: 'read', index: 1, expected: 'R EH1 D' },
  { sentence: 'Lead the team.', word: 'Lead', index: 0, expected: 'L IY1 D' },
  { sentence: 'Pencil lead breaks.', word: 'lead', index: 1, expected: 'L EH1 D' },
  { sentence: 'We live in London.', word: 'live', index: 1, expected: 'L IH1 V' },
  { sentence: 'Live music tonight.', word: 'Live', index: 0, expected: 'L AY1 V' },
  { sentence: 'The wind blows.', word: 'wind', index: 1, expected: 'W IH1 N D' },
  { sentence: 'Wind the clock.', word: 'Wind', index: 0, expected: 'W AY1 N D' },
  { sentence: 'A tear rolled down.', word: 'tear', index: 1, expected: 'T EH1 R' },
  { sentence: 'Do not tear the page.', word: 'tear', index: 3, expected: 'T EH1 R' },
];

describe('heteronym disambiguation', () => {
  it('meets accuracy on hand-built set', () => {
    let correct = 0;
    for (const c of CASES) {
      const phones = resolveHeteronymPhones(c.word, c.sentence, c.index);
      const flat = phones?.join(' ');
      if (flat === c.expected) {
        correct += 1;
      }
    }
    const accuracy = correct / CASES.length;
    console.info(JSON.stringify({ heteronymCases: CASES.length, correct, accuracy }));
    expect(accuracy).toBeGreaterThanOrEqual(0.8);
  });
});
