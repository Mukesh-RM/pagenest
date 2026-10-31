import { decodeWavMono } from './wav-decode';
import { buildReferencePcm, colorizeWithReference } from './lite-vc';
import { loadSpeechT5Tokenizer } from './speecht5-tokenizer';
import { createSpeechT5Stack, type SpeechT5Stack } from './speecht5-onnx';

export type CloneTier = 'full' | 'lite';

export interface CloneWorkerApi {
  setTier(tier: CloneTier): Promise<void>;
  prepareProfile(payload: {
    voiceId: string;
    wavBuffers: readonly ArrayBuffer[];
    xvectModel?: ArrayBuffer;
    allowDownload: boolean;
  }): Promise<{ embedding: Float32Array; referencePcm: Float32Array; tier: CloneTier }>;
  warmSpeechT5(payload: {
    encoderModel: ArrayBuffer;
    decoderModel: ArrayBuffer;
    postnetModel: ArrayBuffer;
    tokenizerJson: ArrayBuffer;
  }): Promise<void>;
  synthesize(payload: {
    text: string;
    embedding: Float32Array;
    referencePcm: Float32Array;
    tier: CloneTier;
    rate: number;
    stackReady: boolean;
  }): Promise<{ samples: Float32Array; sampleRate: number; durationSec: number }>;
  dispose(): Promise<void>;
}

function wasmOrigin(): string {
  try {
    return `${self.location.origin}/ort/`;
  } catch {
    return '/ort/';
  }
}

function shouldMock(): boolean {
  try {
    return import.meta.env.VITE_PN_MOCK_TTS === '1' || import.meta.env.MODE === 'test';
  } catch {
    return false;
  }
}

function l2Normalize(v: Float32Array): Float32Array {
  let n = 0;
  for (let i = 0; i < v.length; i += 1) n += v[i]! * v[i]!;
  n = Math.sqrt(n) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i += 1) out[i] = v[i]! / n;
  return out;
}

function mockEmbeddingFromPcm(pcm: Float32Array, dim = 512): Float32Array {
  const out = new Float32Array(dim);
  for (let i = 0; i < pcm.length; i += 16) {
    const sample = pcm[i] ?? 0;
    const bucket = Math.abs(Math.floor(sample * 1000)) % dim;
    out[bucket] = (out[bucket] ?? 0) + sample * sample;
  }
  return l2Normalize(out);
}

function mockCloneTone(text: string, embedding: Float32Array, sampleRate: number): { samples: Float32Array; sampleRate: number; durationSec: number } {
  const sec = Math.min(8, Math.max(0.4, text.length * 0.06));
  const len = Math.floor(sampleRate * sec);
  const samples = new Float32Array(len);
  const base = 140 + (embedding[0] ?? 0) * 80 + (embedding[1] ?? 0) * 40;
  for (let i = 0; i < len; i += 1) {
    const t = i / sampleRate;
    const env = Math.min(1, t * 15) * Math.min(1, (sec - t) * 10);
    const f0 = base + Math.sin(t * 3) * 6;
    samples[i] = (Math.sin(2 * Math.PI * f0 * t) * 0.18 + Math.sin(2 * Math.PI * f0 * 2 * t) * 0.06) * env;
  }
  return { samples, sampleRate, durationSec: sec };
}

async function runXVectorOnnx(model: ArrayBuffer, pcm16k: Float32Array): Promise<Float32Array> {
  const ort = await import('onnxruntime-web/wasm');
  ort.env.wasm.wasmPaths = wasmOrigin();
  const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
  const inputName = session.inputNames[0] ?? 'input';
  const feeds = {
    [inputName]: new ort.Tensor('float32', pcm16k, [1, pcm16k.length]),
  } as Parameters<typeof session.run>[0];
  const out = await session.run(feeds);
  const key = session.outputNames[0] ?? Object.keys(out)[0]!;
  const tensor = out[key] as { data: Float32Array | number[] };
  const data = tensor.data instanceof Float32Array ? tensor.data : new Float32Array(tensor.data as ArrayLike<number>);
  await session.release();
  return l2Normalize(data.slice(0, 512));
}

function resample(samples: Float32Array, rate: number): Float32Array {
  const targetLen = Math.max(1, Math.floor(samples.length / rate));
  const out = new Float32Array(targetLen);
  for (let i = 0; i < targetLen; i += 1) {
    const src = Math.min(samples.length - 1, Math.floor((i * samples.length) / targetLen));
    out[i] = samples[src] ?? 0;
  }
  return out;
}

const NEURAL_SAMPLE_RATE = 16_000;

/** Shared clone inference used by the worker and unit tests. */
export function createCloneRuntime(): CloneWorkerApi {
  let tier: CloneTier = 'full';
  let mock = shouldMock();
  let speechStack: SpeechT5Stack | undefined;

  async function synthesizeLite(payload: {
    text: string;
    embedding: Float32Array;
    referencePcm: Float32Array;
    rate: number;
  }) {
    const rate = payload.rate || 1;
    const base = mockCloneTone(payload.text, payload.embedding, 22_050);
    let samples = colorizeWithReference(base.samples, payload.referencePcm);
    if (rate !== 1) samples = resample(samples, rate);
    return { samples, sampleRate: 22_050, durationSec: samples.length / 22_050 };
  }

  return {
    async setTier(next) {
      tier = next;
    },
    async warmSpeechT5(payload) {
      if (mock) return;
      if (speechStack) await speechStack.dispose();
      const tokenizer = loadSpeechT5Tokenizer(payload.tokenizerJson);
      speechStack = await createSpeechT5Stack({
        encoderModel: payload.encoderModel,
        decoderModel: payload.decoderModel,
        postnetModel: payload.postnetModel,
        tokenizer,
      });
    },
    async prepareProfile(payload) {
      mock = shouldMock();
      const referencePcm = await buildReferencePcm(payload.wavBuffers);
      const pcm16Chunks: Float32Array[] = [];
      for (const buf of payload.wavBuffers) pcm16Chunks.push(await decodeWavMono(buf, 16_000));
      let embedAcc = new Float32Array(512);
      let count = 0;
      if (mock || !payload.xvectModel) {
        for (const pcm of pcm16Chunks) {
          const e = mockEmbeddingFromPcm(pcm);
          for (let i = 0; i < embedAcc.length; i += 1) embedAcc[i] = (embedAcc[i] ?? 0) + (e[i] ?? 0);
          count += 1;
        }
      } else {
        for (const pcm of pcm16Chunks) {
          try {
            const e = await runXVectorOnnx(payload.xvectModel, pcm);
            for (let i = 0; i < embedAcc.length; i += 1) embedAcc[i] = (embedAcc[i] ?? 0) + (e[i] ?? 0);
            count += 1;
          } catch {
            const e = mockEmbeddingFromPcm(pcm);
            for (let i = 0; i < embedAcc.length; i += 1) embedAcc[i] = (embedAcc[i] ?? 0) + (e[i] ?? 0);
            count += 1;
          }
        }
      }
      if (count > 0) {
        for (let i = 0; i < embedAcc.length; i += 1) embedAcc[i] = (embedAcc[i] ?? 0) / count;
      }
      const embedding = l2Normalize(embedAcc);
      return { embedding, referencePcm, tier: payload.allowDownload ? tier : 'lite' };
    },
    async synthesize(payload) {
      mock = shouldMock();
      const rate = payload.rate || 1;
      const useNeural =
        !mock && payload.stackReady && payload.tier === 'full' && speechStack !== undefined;
      if (useNeural && speechStack) {
        try {
          let samples = await speechStack.synthesize(payload.text, payload.embedding);
          if (rate !== 1) samples = resample(samples, rate);
          return {
            samples,
            sampleRate: NEURAL_SAMPLE_RATE,
            durationSec: samples.length / NEURAL_SAMPLE_RATE,
          };
        } catch {
          /* fall back to lite colorization */
        }
      }
      return synthesizeLite(payload);
    },
    async dispose() {
      if (speechStack) {
        await speechStack.dispose();
        speechStack = undefined;
      }
    },
  };
}
