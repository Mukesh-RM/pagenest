/**
 * Piper synth worker: ONNX Runtime Web inference from phoneme ids only (no G2P, no GPL).
 * ORT WASM is loaded from `ortWasmBaseUrl` at runtime (never bundled in the app shell).
 */

import { runPiperInference, type OrtSessionLike } from './piper-inference';
import type { PiperVoiceConfig } from './piper-voice-config';
import { PiperSynthQueue } from './piper-synth-queue';
import type { PiperWorkerRequest, PiperWorkerResponse } from './piper-worker-protocol';

interface OrtModule {
  InferenceSession: {
    create(buffer: ArrayBuffer, options?: { executionProviders?: string[] }): Promise<{
      run(feeds: Record<string, unknown>, fetches: string[]): Promise<Record<string, { data: Float32Array }>>;
    }>;
  };
  env: { wasm: { wasmPaths?: string; numThreads?: number } };
}

let session: OrtSessionLike | undefined;
let config: PiperVoiceConfig | undefined;
const queue = new PiperSynthQueue();

function post(message: PiperWorkerResponse): void {
  self.postMessage(message);
}

function wrapSession(raw: {
  run(feeds: Record<string, unknown>, fetches: string[]): Promise<Record<string, { data: Float32Array }>>;
}): OrtSessionLike {
  return {
    run: async (feeds, fetches) => {
      const ortFeeds: Record<string, unknown> = {};
      for (const [key, tensor] of Object.entries(feeds)) {
        ortFeeds[key] = {
          type: tensor.data instanceof BigInt64Array ? 'int64' : tensor.data instanceof Int32Array ? 'int32' : 'float32',
          dims: tensor.dims,
          data: tensor.data,
        };
      }
      const out = await raw.run(ortFeeds, fetches);
      const mapped: Record<string, { dims: number[]; data: Float32Array }> = {};
      for (const [key, value] of Object.entries(out)) {
        mapped[key] = { dims: [], data: value.data };
      }
      return mapped;
    },
  };
}

async function loadOrt(wasmBaseUrl?: string): Promise<OrtModule> {
  const ort = (await import('onnxruntime-web')) as OrtModule;
  if (wasmBaseUrl) {
    ort.env.wasm.wasmPaths = wasmBaseUrl;
  }
  ort.env.wasm.numThreads = 1;
  return ort;
}

async function handleInit(msg: Extract<PiperWorkerRequest, { type: 'init' }>): Promise<void> {
  const ort = await loadOrt(msg.ortWasmBaseUrl);
  const raw = await ort.InferenceSession.create(msg.modelBytes, {
    executionProviders: ['wasm'],
  });
  session = wrapSession(raw);
  config = msg.config;
  post({ type: 'ready', requestId: msg.requestId });
}

async function synthesizeJob(
  jobId: string,
  phonemeIds: Int32Array,
  speakerId?: number,
  requestId?: string,
): Promise<void> {
  if (!session || !config) {
    post({
      type: 'error',
      requestId: requestId ?? jobId,
      jobId,
      message: 'Piper is not loaded yet.',
      code: 'unavailable',
    });
    return;
  }
  if (queue.isCancelled(jobId)) {
    post({
      type: 'error',
      requestId: requestId ?? jobId,
      jobId,
      message: 'Cancelled.',
      code: 'aborted',
    });
    return;
  }
  try {
    const result = await runPiperInference(session, config, { phonemeIds, speakerId });
    post({
      type: 'synthesized',
      requestId: requestId ?? jobId,
      jobId,
      samples: result.samples,
      sampleRate: result.sampleRate,
      durationSec: result.durationSec,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Piper synthesis failed.';
    post({
      type: 'error',
      requestId: requestId ?? jobId,
      jobId,
      message,
      code: 'failed',
    });
  }
}

function pumpQueue(): void {
  void queue.drain(async (job) => {
    post({
      type: 'progress',
      requestId: job.jobId,
      queueDepth: queue.depth(),
      activeJobId: queue.activeJobId(),
    });
    await synthesizeJob(job.jobId, job.phonemeIds, job.speakerId, job.jobId);
  });
}

self.onmessage = (event: MessageEvent<PiperWorkerRequest>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'init':
      void handleInit(msg).catch((err) => {
        post({
          type: 'error',
          requestId: msg.requestId,
          message: err instanceof Error ? err.message : 'Failed to load Piper.',
          code: 'failed',
        });
      });
      break;
    case 'synthesize':
      void synthesizeJob(msg.jobId, msg.phonemeIds, msg.speakerId, msg.requestId);
      break;
    case 'enqueue':
      queue.enqueue({
        jobId: msg.jobId,
        phonemeIds: msg.phonemeIds,
        speakerId: msg.speakerId,
      });
      post({
        type: 'progress',
        requestId: msg.requestId,
        queueDepth: queue.depth(),
        activeJobId: queue.activeJobId(),
      });
      pumpQueue();
      break;
    case 'cancel':
      queue.cancel(msg.jobId);
      post({
        type: 'progress',
        requestId: msg.requestId,
        queueDepth: queue.depth(),
        activeJobId: queue.activeJobId(),
      });
      break;
    case 'dispose':
      queue.cancel();
      session = undefined;
      config = undefined;
      post({ type: 'ready', requestId: msg.requestId });
      break;
    default:
      break;
  }
};
