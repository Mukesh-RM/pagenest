import { describe, expect, it } from 'vitest';
import { buildNarrationPlan, splitSentences } from './pipeline';

describe('sentence split', () => {
  it('splits on sentence boundaries with offsets', () => {
    const text = 'Hello world. Alice ran. She stopped!';
    const parts = splitSentences(text);
    expect(parts.map((p) => p.text)).toEqual(['Hello world.', 'Alice ran.', 'She stopped!']);
    expect(parts[0]?.start).toBe(0);
    expect(parts[1]?.start).toBe(13);
  });
});

describe('emotion pipeline', () => {
  it('tags whisper and shout from speech verbs', () => {
    const plan = buildNarrationPlan('"Go away," she whispered. He shouted, "Stop now."', 'expressive');
    expect(plan[0]?.emotion).toBe('whisper');
    expect(plan[1]?.emotion).toBe('shout');
  });

  it('raises pitch for dialogue in expressive mode', () => {
    const plan = buildNarrationPlan('He said "Hello."', 'expressive');
    expect(plan[0]?.delivery.pitch).toBeGreaterThan(0);
  });
});
