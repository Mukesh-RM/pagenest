import type { PiperInferenceResult, PiperModelConfig, PiperSession } from './types';

/** Encode phoneme string into Piper id sequence (^ … $). */
export function phonemesToIds(phonemeText: string, config: PiperModelConfig): number[] {
  const map = config.phoneme_id_map;
  const ids: number[] = [...(map['^'] ?? [1])];
  for (const ch of phonemeText) {
    const entry = map[ch];
    if (entry?.[0] !== undefined) ids.push(entry[0]);
    else if (map[' ']?.[0] !== undefined && ch === ' ') ids.push(map[' '][0]);
  }
  ids.push(...(map['$'] ?? [2]));
  return ids;
}

/** Run a loaded ONNX session (or mock) for one phoneme id sequence. */
export async function runPiperInference(
  session: PiperSession | undefined,
  ids: number[],
  config: PiperModelConfig,
  mockText: string,
): Promise<PiperInferenceResult> {
  const sampleRate = config.audio.sample_rate;
  if (!session) return mockTone(mockText, sampleRate);
  const scales = Float32Array.from([config.inference.noise_scale, config.inference.length_scale, config.inference.noise_w]);
  const input = BigInt64Array.from(ids.map((n) => BigInt(n)));
  const inputLen = BigInt64Array.from([BigInt(ids.length)]);
  const feeds: Record<string, unknown> = {
    input,
    input_lengths: inputLen,
    scales,
  };
  const out = await session.run(feeds);
  const tensor = out.output ?? out[Object.keys(out)[0]!];
  const data = (tensor as { data: Float32Array }).data;
  const samples = data instanceof Float32Array ? data : new Float32Array(data as ArrayLike<number>);
  return { samples, sampleRate, durationSec: samples.length / sampleRate };
}

function mockTone(text: string, sampleRate: number): PiperInferenceResult {
  const sec = Math.min(6, Math.max(0.35, text.length * 0.055));
  const len = Math.floor(sampleRate * sec);
  const samples = new Float32Array(len);
  const freq = 180 + (text.length % 40) * 2;
  for (let i = 0; i < len; i += 1) {
    const t = i / sampleRate;
    const env = Math.min(1, t * 20) * Math.min(1, (sec - t) * 8);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * 0.22 * env;
  }
  return { samples, sampleRate, durationSec: sec };
}
