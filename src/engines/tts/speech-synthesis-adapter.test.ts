// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { chunkForUtteranceLimit, speakToCompletion } from './speech-synthesis-adapter';
import {
  FakeSpeechSynthesis,
  fakeUtteranceFactory,
} from './speech-synthesis.test-helpers';

describe('chunkForUtteranceLimit', () => {
  it('returns a single chunk for short text', () => {
    expect(chunkForUtteranceLimit('hello')).toEqual(['hello']);
  });

  it('splits long text on spaces', () => {
    const long = 'word '.repeat(80).trim();
    const chunks = chunkForUtteranceLimit(long, 40);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toContain('word');
  });
});

describe('speakToCompletion', () => {
  it('speaks all chunks sequentially', async () => {
    const synth = new FakeSpeechSynthesis();
    const factory = fakeUtteranceFactory();
    const long = 'a '.repeat(120).trim();
    await speakToCompletion(synth, factory, {
      text: long,
      lang: 'en-US',
      rate: 1,
      pitch: 1,
      volume: 1,
    });
    expect(synth.spoken.length).toBeGreaterThan(1);
  });

  it('rejects when aborted', async () => {
    const synth = new FakeSpeechSynthesis();
    const controller = new AbortController();
    controller.abort();
    await expect(
      speakToCompletion(synth, fakeUtteranceFactory(), {
        text: 'hi',
        lang: 'en-US',
        rate: 1,
        pitch: 1,
        volume: 1,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
