import { createRpcClient } from '@/data/rpc';
import type { PageNestDB } from '@/data/db';
import type { FileStore } from '@/data/opfs';
import type { ProgressReport } from '@/app/contracts';
import type {
  PrepareOptions,
  SynthesisRequest,
  SynthesisResult,
  VoiceAvailability,
  VoiceEngine,
  VoiceInfo,
} from '../types';
import { voiceError } from '../errors';
import { listOwnVoices, openVoiceSample, readVoiceManifest } from '@/features/voice-studio/data/voice-pack';
import { assertOwnVoiceConsent } from './consent-gate';
import {
  CLONE_STACK_ID,
  SPEECHT5_TTS_MODEL,
  XVECTOR_MODEL,
  cloneModelPath,
  voiceEmbeddingPath,
  voiceReferencePath,
} from './clone-models';
import type { CloneTier, CloneWorkerApi } from './clone.worker';

function detectTier(): CloneTier {
  try {
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (mem !== undefined && mem <= 3) return 'lite';
  } catch {
    /* ignore */
  }
  return 'full';
}

function isMockTtsMode(): boolean {
  try {
    return import.meta.env.VITE_PN_MOCK_TTS === '1' || import.meta.env.MODE === 'test';
  } catch {
    return false;
  }
}

async function downloadUrl(url: string, signal?: AbortSignal, onProgress?: (p: ProgressReport) => void): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw voiceError('failed', 'Could not download the voice model.');
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (total > 0) {
      onProgress?.({ done: loaded, total: total || undefined });
    }
  }
  const out = new Uint8Array(loaded);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out.buffer;
}

async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Response(file).arrayBuffer();
}

export function createCloneEngine(deps: {
  readonly db: PageNestDB;
  readonly files: FileStore;
  readonly readCloneModel: (fileName: string) => Promise<ArrayBuffer | undefined>;
  readonly writeCloneModel: (fileName: string, data: ArrayBuffer) => Promise<void>;
  readonly createWorker: () => Worker;
}): VoiceEngine {
  let worker: ReturnType<typeof createRpcClient<CloneWorkerApi>> | undefined;
  let rawWorker: Worker | undefined;
  const profiles = new Map<
    string,
    { embedding: Float32Array; referencePcm: Float32Array; tier: CloneTier; stackReady: boolean }
  >();

  const ensureWorker = () => {
    if (!worker) {
      rawWorker = deps.createWorker();
      worker = createRpcClient<CloneWorkerApi>(rawWorker, ['setTier', 'prepareProfile', 'synthesize', 'warmSpeechT5', 'dispose']);
    }
    return worker.api;
  };

  return {
    id: 'helper',
    tier: 2,
    capabilities: {
      output: 'buffer',
      backgroundSafe: true,
      supportsProsody: true,
      supportsEmotion: false,
      supportsOwnVoice: true,
      needsDownload: true,
    },
    async checkAvailability(): Promise<VoiceAvailability> {
      if (typeof Worker === 'undefined') return { available: false, reason: 'Web Workers are required for your voice.' };
      return { available: true };
    },
    async listVoices(): Promise<readonly VoiceInfo[]> {
      const rows = await listOwnVoices(deps.db);
      const out: VoiceInfo[] = [];
      for (const row of rows) {
        const ok = await canUse(row.id);
        if (!ok) continue;
        const emb = await deps.files.exists(voiceEmbeddingPath(row.id));
        out.push({
          id: row.id,
          name: row.name === row.name.trim() ? row.name : 'My voice',
          engine: 'helper',
          language: row.language,
          isOwnVoice: true,
          sizeBytes: XVECTOR_MODEL.sizeBytes + SPEECHT5_TTS_MODEL.approxBytes,
          installed: emb,
        });
      }
      return out;
    },
    async prepareVoice(voiceId: string, options?: PrepareOptions): Promise<void> {
      await assertOwnVoiceConsent(deps.db, deps.files, voiceId);
      const manifest = await readVoiceManifest(deps.files, voiceId);
      if (!manifest) throw voiceError('voice-not-found', 'This voice is missing.');
      options?.onProgress?.({ done: 1, total: 10 });

      const wavBuffers: ArrayBuffer[] = [];
      wavBuffers.push(await fileToArrayBuffer(await openVoiceSample(deps.files, voiceId, 'consent.wav')));
      for (const p of manifest.prompts) {
        wavBuffers.push(await fileToArrayBuffer(await openVoiceSample(deps.files, voiceId, p.file)));
      }

      let xvect = await deps.readCloneModel('xvect.onnx');
      if (!xvect && options?.allowDownload && !isMockTtsMode()) {
        xvect = await downloadUrl(XVECTOR_MODEL.url, options.signal, options.onProgress);
        await deps.writeCloneModel('xvect.onnx', xvect);
      }

      const tier = detectTier();
      await ensureWorker().setTier(tier);

      let stackReady = false;
      if (tier === 'full' && options?.allowDownload && !isMockTtsMode()) {
        options.onProgress?.({ done: 4, total: 10 });
        stackReady = await ensureSpeechT5Cached(options);
      }

      options?.onProgress?.({ done: 7, total: 10 });
      const profile = await ensureWorker().prepareProfile({
        voiceId,
        wavBuffers,
        xvectModel: xvect,
        allowDownload: Boolean(options?.allowDownload),
      });

      await deps.files.write(voiceEmbeddingPath(voiceId), new Blob([new Float32Array(profile.embedding)]));
      await deps.files.write(voiceReferencePath(voiceId), new Blob([new Float32Array(profile.referencePcm)]));

      profiles.set(voiceId, {
        embedding: profile.embedding,
        referencePcm: profile.referencePcm,
        tier: profile.tier,
        stackReady,
      });
      options?.onProgress?.({ done: 10, total: 10 });
    },
    async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
      await assertOwnVoiceConsent(deps.db, deps.files, request.voiceId);
      let profile = profiles.get(request.voiceId);
      if (!profile) {
        profile = await loadProfileFromDisk(request.voiceId);
        profiles.set(request.voiceId, profile);
      }
      const result = await ensureWorker().synthesize({
        text: request.text,
        embedding: profile.embedding,
        referencePcm: profile.referencePcm,
        tier: profile.tier,
        rate: request.delivery.rate,
        stackReady: profile.stackReady,
      });
      return {
        kind: 'buffer',
        samples: result.samples,
        sampleRate: result.sampleRate,
        durationSec: result.durationSec,
      };
    },
    async dispose(): Promise<void> {
      profiles.clear();
      if (worker) {
        await worker.api.dispose();
        worker.close();
        rawWorker?.terminate();
        worker = undefined;
        rawWorker = undefined;
      }
    },
  };

  async function canUse(voiceId: string): Promise<boolean> {
    try {
      await assertOwnVoiceConsent(deps.db, deps.files, voiceId);
      return true;
    } catch {
      return false;
    }
  }

  async function loadProfileFromDisk(voiceId: string) {
    const embFile = await deps.files.open(voiceEmbeddingPath(voiceId));
    const refFile = await deps.files.open(voiceReferencePath(voiceId));
    const embedding = new Float32Array(await fileToArrayBuffer(embFile));
    const referencePcm = new Float32Array(await fileToArrayBuffer(refFile));
    const marker = await deps.readCloneModel('stack-ready.txt');
    return { embedding, referencePcm, tier: detectTier(), stackReady: Boolean(marker) };
  }

  async function ensureSpeechT5Cached(_options?: PrepareOptions): Promise<boolean> {
    return false;
  }
}

export function cloneEngineStoragePrefix(): string {
  return cloneModelPath('');
}

export { CLONE_STACK_ID };
