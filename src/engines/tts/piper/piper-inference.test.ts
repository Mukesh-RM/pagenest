// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { encodePhonemeString } from './phoneme-ids';
import { runPiperInference, type OrtSessionLike } from './piper-inference';
import type { PiperVoiceConfig } from './piper-voice-config';

const miniConfig: PiperVoiceConfig = {
  audio: { sample_rate: 22050 },
  inference: { noise_scale: 0.333, length_scale: 1, noise_w: 0.333 },
  phoneme_type: 'espeak',
  phoneme_id_map: {
    _: [0],
    '^': [1],
    $: [2],
    ' ': [3],
    h: [20],
    ə: [59],
    l: [24],
    o: [27],
    ʊ: [100],
    ˈ: [120],
  },
  num_symbols: 256,
  num_speakers: 1,
};

function fakeSession(durationSamples: number): OrtSessionLike {
  return {
    run: async () => ({
      output: {
        dims: [1, durationSamples],
        data: Float32Array.from({ length: durationSamples }, (_, i) => Math.sin(i / 50) * 0.1),
      },
    }),
  };
}

describe('runPiperInference', () => {
  it('returns PCM with plausible duration', async () => {
    const { ids } = encodePhonemeString(miniConfig, 'həlˈoʊ');
    const out = await runPiperInference(fakeSession(2205), miniConfig, { phonemeIds: ids });
    expect(out.sampleRate).toBe(22050);
    expect(out.durationSec).toBeCloseTo(0.1, 2);
    expect(out.samples.length).toBe(2205);
  });

  it('rejects NaN audio', async () => {
    const bad: OrtSessionLike = {
      run: async () => ({
        output: { dims: [1, 10], data: Float32Array.from([NaN]) },
      }),
    };
    const { ids } = encodePhonemeString(miniConfig, 'hə');
    await expect(runPiperInference(bad, miniConfig, { phonemeIds: ids })).rejects.toThrow(
      /non-finite/,
    );
  });
});
