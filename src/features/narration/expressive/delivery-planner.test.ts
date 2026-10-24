// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { planExpressiveDelivery } from './delivery-planner';
import { tagSentenceEmotion } from './emotion-tagger';

describe('planExpressiveDelivery', () => {
  it('adjusts Piper scales for whisper', () => {
    const tag = tagSentenceEmotion('Come closer.', 'whispered');
    const plan = planExpressiveDelivery('Come closer.', tag, 'dialogue', 'she', {
      baseLengthScale: 1,
      baseNoiseScale: 0.333,
      baseNoiseW: 0.333,
      narrationVoiceId: 'narrator',
      dialogueVoiceId: 'dialogue',
    });
    expect(plan.piper.noiseScale).toBeLessThan(0.333);
    expect(plan.volume).toBeLessThan(1);
    expect(plan.voiceId).toBe('dialogue');
  });
});
