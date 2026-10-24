// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SpeechSynthesisVoiceEngine } from './speech-synthesis-engine';
import { isVoiceEngineError } from './voice-engine-error';
import {
  FakeSpeechSynthesis,
  defaultVoice,
  fakeUtteranceFactory,
} from './speech-synthesis.test-helpers';

describe('SpeechSynthesisVoiceEngine', () => {
  const synth = new FakeSpeechSynthesis([defaultVoice()]);
  const engine = new SpeechSynthesisVoiceEngine({
    synth,
    utteranceFactory: fakeUtteranceFactory(),
  });

  it('lists installed voices', async () => {
    const voices = await engine.listVoices('en');
    expect(voices[0]?.id).toBe('test-en-us');
    expect(voices[0]?.installed).toBe(true);
  });

  it('synthesizes with clamped rate', async () => {
    const result = await engine.synthesize({
      voiceId: 'test-en-us',
      text: 'Hello world.',
      language: 'en-US',
      delivery: { rate: 5, pitch: 0, volume: 1, pauseAfterMs: 0 },
    });
    expect(result.kind).toBe('live');
    expect(synth.spoken[0]?.rate).toBe(3);
  });

  it('throws for unknown voice', async () => {
    await expect(
      engine.synthesize({
        voiceId: 'missing',
        text: 'Hi',
        language: 'en-US',
        delivery: { rate: 1, pitch: 0, volume: 1, pauseAfterMs: 0 },
      }),
    ).rejects.toSatisfy((err: unknown) => isVoiceEngineError(err) && err.code === 'voice-not-found');
  });

  it('reports unavailable without synth', async () => {
    const offline = new SpeechSynthesisVoiceEngine({ synth: undefined });
    const availability = await offline.checkAvailability();
    expect(availability.available).toBe(false);
  });
});
