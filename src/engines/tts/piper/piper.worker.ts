import { serveRpc, type RpcPort } from '@/data/rpc';
import { textToPhonemeString } from './g2p/text-to-phonemes';
import { phonemesToIds, runPiperInference } from './inference';
import type { PiperModelConfig, PiperSession } from './types';

interface WorkerState {
  config?: PiperModelConfig;
  session?: PiperSession;
  mock: boolean;
}

const state: WorkerState = { mock: shouldMock() };

function shouldMock(): boolean {
  try {
    return import.meta.env.VITE_PN_MOCK_TTS === '1' || import.meta.env.MODE === 'test';
  } catch {
    return false;
  }
}

const api = {
  async loadModel(payload: { configJson: string; modelBuffer?: ArrayBuffer }) {
    state.config = JSON.parse(payload.configJson) as PiperModelConfig;
    state.session = undefined;
    if (state.mock || !payload.modelBuffer) return;
    const ort = await import('onnxruntime-web/wasm');
    const ortBase = `${self.location.origin}/ort/`;
    ort.env.wasm.wasmPaths = {
      mjs: `${ortBase}ort-wasm-simd-threaded.mjs`,
      wasm: `${ortBase}ort-wasm-simd-threaded.wasm`,
    };
    ort.env.wasm.numThreads = 1;
    const created = await ort.InferenceSession.create(payload.modelBuffer, {
      executionProviders: ['wasm'],
    });
    state.session = {
      inputNames: created.inputNames,
      run: async (feeds) => {
        const out = await created.run(feeds as never);
        return out as Record<string, { data: Float32Array | ArrayLike<number> }>;
      },
    };
  },
  async synthesize(payload: { text: string; rate: number }) {
    if (!state.config) throw new Error('Voice not loaded');
    const phonemes = textToPhonemeString(payload.text);
    const ids = phonemesToIds(phonemes, state.config);
    const base = await runPiperInference(state.session, ids, state.config, payload.text);
    if (payload.rate === 1) return base;
    const targetLen = Math.max(1, Math.floor(base.samples.length / payload.rate));
    const resampled = new Float32Array(targetLen);
    for (let i = 0; i < targetLen; i += 1) {
      const src = Math.min(base.samples.length - 1, Math.floor((i * base.samples.length) / targetLen));
      resampled[i] = base.samples[src] ?? 0;
    }
    return { samples: resampled, sampleRate: base.sampleRate, durationSec: targetLen / base.sampleRate };
  },
  dispose() {
    state.config = undefined;
    state.session = undefined;
  },
};

serveRpc(self as unknown as RpcPort, api);

export type PiperWorkerApi = typeof api;
