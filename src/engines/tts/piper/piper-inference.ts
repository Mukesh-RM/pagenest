import { inferenceScales, type PiperVoiceConfig } from './piper-voice-config';

/** Minimal ORT session surface (real `onnxruntime-web` or test fake). */
export interface OrtTensor {
  readonly dims: readonly number[];
  readonly data: Int32Array | BigInt64Array | Float32Array;
}

export interface OrtSessionLike {
  run(
    feeds: Record<string, OrtTensor>,
    fetches: string[],
  ): Promise<Record<string, OrtTensor>>;
}

export interface PiperInferenceInput {
  readonly phonemeIds: Int32Array;
  readonly speakerId?: number;
}

export interface PiperInferenceOutput {
  readonly samples: Float32Array;
  readonly sampleRate: number;
  readonly durationSec: number;
}

export function createPhonemeTensor(ids: Int32Array): OrtTensor {
  const data = new BigInt64Array(ids.length);
  for (let i = 0; i < ids.length; i += 1) {
    data[i] = BigInt(ids[i] ?? 0);
  }
  return {
    dims: [1, ids.length],
    data,
  };
}

export function createLengthTensor(length: number): OrtTensor {
  const data = new BigInt64Array([BigInt(length)]);
  return { dims: [1], data };
}

export function createScalesTensor(scales: [number, number, number]): OrtTensor {
  return { dims: [3], data: Float32Array.from(scales) };
}

export function createSpeakerTensor(speakerId: number): OrtTensor {
  const data = new BigInt64Array([BigInt(speakerId)]);
  return { dims: [1], data };
}

/**
 * Run Piper VITS ONNX (phoneme ids in, audio out). Matches rhasspy/piper ONNX export I/O names.
 */
export async function runPiperInference(
  session: OrtSessionLike,
  config: PiperVoiceConfig,
  input: PiperInferenceInput,
): Promise<PiperInferenceOutput> {
  const ids = input.phonemeIds;
  if (ids.length === 0) {
    throw new Error('Phoneme id sequence is empty.');
  }

  const feeds: Record<string, OrtTensor> = {
    input: createPhonemeTensor(ids),
    input_lengths: createLengthTensor(ids.length),
    scales: createScalesTensor(inferenceScales(config)),
  };

  if (input.speakerId !== undefined && config.num_speakers > 1) {
    feeds.sid = createSpeakerTensor(input.speakerId);
  }

  const outputs = await session.run(feeds, ['output']);
  const audio = outputs.output?.data;
  if (!(audio instanceof Float32Array)) {
    throw new Error('Piper model did not return audio.');
  }
  if (audio.some((v) => !Number.isFinite(v))) {
    throw new Error('Piper model returned non-finite audio samples.');
  }

  const sampleRate = config.audio.sample_rate;
  const durationSec = audio.length / sampleRate;
  if (durationSec <= 0) {
    throw new Error('Piper model returned empty audio.');
  }

  return { samples: audio, sampleRate, durationSec };
}
