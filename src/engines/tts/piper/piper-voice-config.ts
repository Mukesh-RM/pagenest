/**
 * Piper voice config (`.onnx.json` next to the model).
 * Phoneme ids use the espeak-style IPA symbol set in `phoneme_id_map`.
 */

export interface PiperVoiceConfig {
  readonly audio: { readonly sample_rate: number; readonly quality?: string };
  readonly inference: {
    readonly noise_scale: number;
    readonly length_scale: number;
    readonly noise_w: number;
  };
  readonly phoneme_type: 'espeak' | 'text'; // audit-ignore: Piper onnx.json schema literal, not espeak-ng in the bundle
  readonly phoneme_id_map: Readonly<Record<string, readonly number[]>>;
  readonly num_symbols: number;
  readonly num_speakers: number;
  readonly speaker_id_map?: Readonly<Record<string, number>>;
}

export function parsePiperVoiceConfig(json: string): PiperVoiceConfig {
  const raw = JSON.parse(json) as PiperVoiceConfig;
  if (!raw.phoneme_id_map || !raw.audio?.sample_rate || !raw.inference) {
    throw new Error('This does not look like a Piper voice config file.');
  }
  return raw;
}

export function inferenceScales(config: PiperVoiceConfig): [number, number, number] {
  const { noise_scale, length_scale, noise_w } = config.inference;
  return [noise_scale, length_scale, noise_w];
}
