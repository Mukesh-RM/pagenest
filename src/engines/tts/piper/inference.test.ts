import { describe, expect, it, vi } from 'vitest';
import { defaultPiperSpeakerId, runPiperInference } from '@/engines/tts/piper/inference';
import type { PiperModelConfig, PiperSession } from '@/engines/tts/piper/types';

const config: PiperModelConfig = {
  audio: { sample_rate: 22050 },
  inference: { noise_scale: 0.667, length_scale: 1, noise_w: 0.8 },
  phoneme_id_map: { '^': [1], $: [2], h: [9] },
  num_speakers: 904,
};

describe('piper inference feeds', () => {
  it('includes sid when the ONNX model expects it', async () => {
    const run = vi.fn(async (feeds: Record<string, unknown>) => {
      expect(feeds.sid).toBeInstanceOf(BigInt64Array);
      expect((feeds.sid as BigInt64Array)[0]).toBe(BigInt(defaultPiperSpeakerId(config)));
      return { output: { data: new Float32Array(100) } };
    });
    const session: PiperSession = { inputNames: ['input', 'input_lengths', 'scales', 'sid'], run };
    await runPiperInference(session, [1, 9, 2], config, 'Hi');
    expect(run).toHaveBeenCalledOnce();
  });

  it('omits sid for single-speaker graphs', async () => {
    const run = vi.fn(async (feeds: Record<string, unknown>) => {
      expect(feeds.sid).toBeUndefined();
      return { output: { data: new Float32Array(50) } };
    });
    const session: PiperSession = { inputNames: ['input', 'input_lengths', 'scales'], run };
    await runPiperInference(session, [1, 9, 2], { ...config, num_speakers: 1 }, 'Hi');
    expect(run).toHaveBeenCalledOnce();
  });
});
