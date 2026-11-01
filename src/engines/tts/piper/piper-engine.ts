import { createRpcClient } from '@/data/rpc';
import type {
  PrepareOptions,
  SynthesisRequest,
  SynthesisResult,
  VoiceAvailability,
  VoiceEngine,
  VoiceInfo,
} from '../types';
import { voiceError } from '../errors';
import { OK_PIPER_VOICES, modelUrls, piperVoiceById } from './voices';
import { downloadPiperWeights, fetchPiperConfig } from './voice-download';
import type { PiperWorkerApi } from './piper.worker';

function isMockTtsMode(): boolean {
  try {
    return import.meta.env.VITE_PN_MOCK_TTS === '1' || import.meta.env.MODE === 'test';
  } catch {
    return false;
  }
}

export function createPiperEngine(deps: {
  readonly readModel: (voiceId: string) => Promise<ArrayBuffer | undefined>;
  readonly writeModel: (voiceId: string, data: ArrayBuffer) => Promise<void>;
  readonly createWorker: () => Worker;
}): VoiceEngine {
  let worker: ReturnType<typeof createRpcClient<PiperWorkerApi>> | undefined;
  let loadedVoice: string | undefined;

  const ensureWorker = () => {
    if (!worker) {
      const w = deps.createWorker();
      worker = createRpcClient<PiperWorkerApi>(w, ['loadModel', 'synthesize', 'dispose']);
    }
    return worker.api;
  };

  return {
    id: 'piper',
    tier: 1,
    capabilities: {
      output: 'buffer',
      backgroundSafe: true,
      supportsProsody: true,
      supportsEmotion: false,
      supportsOwnVoice: true,
      needsDownload: true,
    },
    async checkAvailability(): Promise<VoiceAvailability> {
      if (typeof Worker === 'undefined') return { available: false, reason: 'Web Workers are not available in this browser.' };
      if (typeof WebAssembly === 'undefined') return { available: false, reason: 'WebAssembly is required for on-device voices.' };
      return { available: true };
    },
    async listVoices(language?: string): Promise<readonly VoiceInfo[]> {
      const lang = language?.toLowerCase();
      const rows = OK_PIPER_VOICES.filter((v) => !lang || v.language.toLowerCase().startsWith(lang.slice(0, 2)));
      const installed = await Promise.all(rows.map(async (v) => Boolean(await deps.readModel(v.id))));
      return rows.map((v, i) => ({
        id: v.id,
        name: v.name,
        engine: 'piper',
        language: v.language,
        isOwnVoice: false,
        sizeBytes: v.sizeBytes,
        installed: installed[i] ?? false,
      }));
    },
    async prepareVoice(voiceId: string, options?: PrepareOptions): Promise<void> {
      const meta = piperVoiceById(voiceId);
      if (!meta) throw voiceError('voice-not-found', 'That voice is not available.');
      let model = await deps.readModel(voiceId);
      if (!model && !isMockTtsMode()) {
        if (!options?.allowDownload) throw voiceError('download-required', 'Download this voice to read aloud offline.');
        model = await downloadPiperWeights(voiceId, options);
        await deps.writeModel(voiceId, model);
      }
      const urls = modelUrls(voiceId);
      if (!urls) throw voiceError('voice-not-found', 'That voice is not available.');
      const configJson = isMockTtsMode()
        ? JSON.stringify(mockConfig())
        : await fetchPiperConfig(voiceId, options?.signal);
      await ensureWorker().loadModel({ configJson, modelBuffer: model });
      loadedVoice = voiceId;
    },
    async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
      if (loadedVoice !== request.voiceId) await this.prepareVoice(request.voiceId);
      const remote = ensureWorker();
      const { samples, sampleRate, durationSec } = await remote.synthesize({
        text: request.text,
        rate: request.delivery.rate,
      });
      const pitch = request.delivery.pitch;
      const out =
        pitch === 0
          ? samples
          : pitchShift(samples, sampleRate, pitch);
      return { kind: 'buffer', samples: out, sampleRate, durationSec };
    },
    async dispose(): Promise<void> {
      await worker?.api.dispose();
      worker?.close();
      worker = undefined;
      loadedVoice = undefined;
    },
  };
}

function mockConfig() {
  return {
    audio: { sample_rate: 22050 },
    inference: { noise_scale: 0.667, length_scale: 1, noise_w: 0.8 },
    phoneme_id_map: { '^': [1], $: [2], ' ': [3], a: [14], e: [18], l: [24], o: [27] },
  };
}

function pitchShift(samples: Float32Array, _sampleRate: number, semitones: number): Float32Array {
  if (semitones === 0) return samples;
  const ratio = 2 ** (semitones / 12);
  const len = Math.max(1, Math.floor(samples.length / ratio));
  const out = new Float32Array(len);
  for (let i = 0; i < len; i += 1) {
    const src = Math.min(samples.length - 1, Math.floor(i * ratio));
    out[i] = samples[src] ?? 0;
  }
  return out;
}
