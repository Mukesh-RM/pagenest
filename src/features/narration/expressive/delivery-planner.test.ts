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

  it('ignores cast speaker ids for single-speaker audiobook voices', () => {
    const tag = tagSentenceEmotion('Hello.', undefined);
    const plan = planExpressiveDelivery('Hello.', tag, 'dialogue', 'alice', {
      baseLengthScale: 1,
      baseNoiseScale: 0.333,
      baseNoiseW: 0.333,
      narrationVoiceId: 'en_US-ljspeech-medium',
      castVoiceBySpeaker: { alice: 'en_US-kristin-medium' },
      castSpeakerIdBySpeaker: { alice: 42 },
    });
    expect(plan.voiceId).toBe('en_US-kristin-medium');
    expect(plan.speakerId).toBeUndefined();
  });

  it('applies cast speaker ids only for multi-speaker voices', () => {
    const tag = tagSentenceEmotion('Hello.', undefined);
    const plan = planExpressiveDelivery('Hello.', tag, 'narration', 'bob', {
      baseLengthScale: 1,
      baseNoiseScale: 0.333,
      baseNoiseW: 0.333,
      narrationVoiceId: 'en_US-libritts-high',
      castSpeakerIdBySpeaker: { bob: 7 },
    });
    expect(plan.voiceId).toBe('en_US-libritts-high');
    expect(plan.speakerId).toBe(7);
  });
});
