// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fakeUtteranceFactory, FakeSpeechSynthesis, defaultVoice } from '@/engines/tts/speech-synthesis.test-helpers';
import { SpeechNarrationSession } from './speech-narration-session';

describe('SpeechNarrationSession', () => {
  it('emits sentence-level highlights and completes', async () => {
    const synth = new FakeSpeechSynthesis([defaultVoice()]);
    const highlights: string[] = [];
    const session = new SpeechNarrationSession({
      synth,
      utteranceFactory: fakeUtteranceFactory(),
      onHighlight: (e) => {
        highlights.push(`${e.sentenceIndex}:${e.granularity}`);
      },
    });
    await session.start({
      text: 'First sentence. Second sentence.',
      language: 'en',
      voiceId: 'test-en-us',
      rate: 2,
    });
    expect(highlights.some((h) => h.startsWith('0:sentence'))).toBe(true);
    expect(session.getStatus().state).toBe('stopped');
  });

  it('clamps speed', () => {
    const session = new SpeechNarrationSession({
      synth: new FakeSpeechSynthesis(),
      utteranceFactory: fakeUtteranceFactory(),
    });
    session.setRate(10);
    expect(session.getStatus().rate).toBe(3);
    session.setRate(0.1);
    expect(session.getStatus().rate).toBe(0.5);
  });

  it('stop aborts playback', async () => {
    const synth = new FakeSpeechSynthesis([defaultVoice()]);
    const session = new SpeechNarrationSession({
      synth,
      utteranceFactory: fakeUtteranceFactory(),
    });
    const promise = session.start({
      text: 'One. Two. Three.',
      language: 'en',
      voiceId: 'test-en-us',
    });
    session.stop();
    await expect(promise).rejects.toMatchObject({ code: 'aborted' });
  });
});
