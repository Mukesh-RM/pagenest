export interface PiperModelConfig {
  audio: { sample_rate: number };
  inference: { noise_scale: number; length_scale: number; noise_w: number };
  phoneme_id_map: Record<string, number[]>;
}

export interface PiperInferenceResult {
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
}

export interface PiperSession {
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array | ArrayLike<number> }>>;
}
