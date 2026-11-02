import { describe, expect, it } from 'vitest';
import { planDelivery } from './delivery-planner';
import { buildNarrationPlan, splitSentences } from './pipeline';
import type { TaggedSentence } from './types';

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

  it('assigns stable per-speaker pitch in cast mode', () => {
    const tagged: TaggedSentence[] = [
      { index: 0, text: '"Hi."', start: 0, end: 5, kind: 'dialogue', speaker: 'Alice', emotion: 'calm' },
      { index: 1, text: '"Hey."', start: 5, end: 11, kind: 'dialogue', speaker: 'Bob', emotion: 'calm' },
      { index: 2, text: '"Again."', start: 11, end: 19, kind: 'dialogue', speaker: 'Alice', emotion: 'calm' },
    ];
    const plan = planDelivery(tagged, 'cast');
    expect(plan[0]!.delivery.pitch).toBe(plan[2]!.delivery.pitch);
    expect(plan[1]!.delivery.pitch).not.toBe(plan[0]!.delivery.pitch);
  });
});
