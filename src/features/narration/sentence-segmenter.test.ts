// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { segmentSentences, segmentWithRules } from './sentence-segmenter';

describe('segmentWithRules', () => {
  it('splits on periods and keeps abbreviations', () => {
    const text = 'Dr. Smith went home. Mr. Jones stayed.';
    const spans = segmentWithRules(text);
    expect(spans).toHaveLength(2);
    expect(spans[0]?.text).toBe('Dr. Smith went home.');
    expect(spans[1]?.text).toBe('Mr. Jones stayed.');
  });

  it('does not split decimals', () => {
    const text = 'The value is 3.14 units. Done.';
    const spans = segmentWithRules(text);
    expect(spans).toHaveLength(2);
    expect(spans[0]?.text).toBe('The value is 3.14 units.');
  });

  it('handles ellipses', () => {
    const text = 'Wait... Really? Yes.';
    const spans = segmentWithRules(text);
    expect(spans.map((s) => s.text)).toEqual(['Wait...', 'Really?', 'Yes.']);
  });

  it('handles CJK sentence endings', () => {
    const text = '你好。世界！对吗？';
    const spans = segmentWithRules(text);
    expect(spans).toHaveLength(3);
    expect(spans[0]?.text).toBe('你好。');
  });

  it('preserves offsets in the source string', () => {
    const text = '  Hello.   World.  ';
    const spans = segmentWithRules(text);
    expect(text.slice(spans[0]?.start ?? 0, spans[0]?.end)).toBe('Hello.');
    expect(text.slice(spans[1]?.start ?? 0, spans[1]?.end)).toBe('World.');
  });
});

describe('segmentSentences', () => {
  it('uses Intl when available', () => {
    const text = 'One. Two.';
    const spans = segmentSentences(text, 'en');
    expect(spans.length).toBeGreaterThanOrEqual(1);
  });
});
