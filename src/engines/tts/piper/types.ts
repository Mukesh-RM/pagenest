export interface PiperModelConfig {
  audio: { sample_rate: number };
  inference: { noise_scale: number; length_scale: number; noise_w: number };
  phoneme_id_map: Record<string, number[]>;
  num_speakers?: number;
  speaker_id_map?: Record<string, string>;
}

export interface PiperSession {
  readonly inputNames?: readonly string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array | ArrayLike<number> }>>;
}

export interface PiperInferenceResult {
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
}
