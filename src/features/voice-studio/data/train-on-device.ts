import { createRpcClient } from '@/data/rpc';
import type { PageNestDB } from '@/data/db';
import type { FileStore } from '@/data/opfs';
import type { VoiceRecord } from '@/data/schema';
import type { CloneWorkerApi } from '@/engines/tts/helper/clone.worker';
import { readVoiceSampleWavs } from './voice-pack';
import { voiceEmbeddingPath, voiceReferencePath } from '@/engines/tts/helper/clone-models';

export type OnDeviceTrainResult =
  | { ok: true; tier: 'lite' | 'full'; embeddingBytes: number }
  | { ok: false; reason: 'no_samples' | 'error'; message?: string };

const CLONE_METHODS = ['setTier', 'prepareProfile', 'synthesize', 'warmSpeechT5', 'dispose'] as const;

/**
 * Builds an on-device clone profile from saved WAV samples (Phase 6) and stores embedding/reference in OPFS.
 */
export async function trainVoiceOnDevice(
  files: FileStore,
  _db: PageNestDB,
  voice: VoiceRecord,
): Promise<OnDeviceTrainResult> {
  const wavBuffers = await readVoiceSampleWavs(files, voice.id);
  if (!wavBuffers.length) return { ok: false, reason: 'no_samples' };
  const worker = new Worker(new URL('../../../engines/tts/helper/clone.worker.ts', import.meta.url), { type: 'module' });
  const client = createRpcClient<CloneWorkerApi>(worker, [...CLONE_METHODS]);
  try {
    await client.api.setTier('lite');
    const profile = await client.api.prepareProfile({
      voiceId: voice.id,
      wavBuffers,
      allowDownload: false,
    });
    await files.write(voiceEmbeddingPath(voice.id), profile.embedding.slice().buffer);
    await files.write(voiceReferencePath(voice.id), profile.referencePcm.slice().buffer);
    return { ok: true, tier: profile.tier, embeddingBytes: profile.embedding.byteLength };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  } finally {
    client.close();
    worker.terminate();
  }
}
