import type { PageNestDB } from '@/data/db';
import type { FileStore } from '@/data/opfs';
import type { VoiceRecord } from '@/data/schema';
import type { ProgressReport } from '@/app/contracts';
import { createCloneEngine } from '@/engines/tts/helper/clone-engine';
import { createCloneModelStore } from '@/engines/tts/helper/clone-model-store';
import { isPhoneVoiceCloneEnabled } from '@/engines/tts/helper/clone-shipping';

export type PreparePhoneVoiceResult = { ok: true } | { ok: false; message: string };

/**
 * Downloads SpeechT5 + x-vector when needed, runs real x-vector embedding from saved WAVs,
 * and stores speaker profile in OPFS (post-launch phone clone path).
 */
export async function preparePhoneVoiceOnDevice(
  files: FileStore,
  db: PageNestDB,
  voice: VoiceRecord,
  options?: {
    readonly signal?: AbortSignal;
    readonly onProgress?: (p: ProgressReport) => void;
  },
): Promise<PreparePhoneVoiceResult> {
  if (!isPhoneVoiceCloneEnabled()) {
    return { ok: false, message: 'On-phone voice cloning is not enabled in this build.' };
  }
  const store = createCloneModelStore(files);
  const engine = createCloneEngine({
    db,
    files,
    ...store,
    createWorker: () => new Worker(new URL('../../../engines/tts/helper/clone.worker.ts', import.meta.url), { type: 'module' }),
  });
  try {
    await engine.prepareVoice(voice.id, {
      allowDownload: true,
      signal: options?.signal,
      onProgress: options?.onProgress,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  } finally {
    await engine.dispose();
  }
}
