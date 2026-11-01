import type { PageNestDB } from '@/data/db';
import type { FileStore } from '@/data/opfs';
import type { VoiceEngine, VoiceEngineId } from './types';
import { createCloneEngine } from './helper/clone-engine';
import { createCompositeVoiceEngine } from './helper/composite-engine';
import { createCloneModelStore } from './helper/clone-model-store';
import { canUseClonedVoice } from './helper/consent-gate';
import { createKokoroEngine } from './kokoro/kokoro-engine';
import { createPiperEngine } from './piper/piper-engine';
import { createSpeechEngine } from './speech-engine';

export type { VoiceEngine, VoiceEngineId } from './types';

export function createDefaultVoiceEngine(deps: Parameters<typeof createPiperEngine>[0]): VoiceEngine {
  return createPiperEngine(deps);
}

export function createNarrationVoiceEngine(
  piperDeps: Parameters<typeof createPiperEngine>[0],
  cloneDeps: { readonly db: PageNestDB; readonly files: FileStore; readonly createCloneWorker?: () => Worker },
): VoiceEngine {
  const piper = createPiperEngine(piperDeps);
  const store = createCloneModelStore(cloneDeps.files);
  const clone = createCloneEngine({
    db: cloneDeps.db,
    files: cloneDeps.files,
    ...store,
    createWorker:
      cloneDeps.createCloneWorker ??
      (() => new Worker(new URL('./helper/clone.worker.ts', import.meta.url), { type: 'module' })),
  });
  return createCompositeVoiceEngine(piper, clone, (voiceId) => canUseClonedVoice(cloneDeps.db, cloneDeps.files, voiceId));
}

export function createVoiceEngine(id: VoiceEngineId, deps: Parameters<typeof createPiperEngine>[0]): VoiceEngine {
  switch (id) {
    case 'speech':
      return createSpeechEngine();
    case 'piper':
      return createPiperEngine(deps);
    case 'kokoro':
      return createKokoroEngine();
    case 'helper':
      return createPiperEngine(deps);
    default:
      return createPiperEngine(deps);
  }
}

export { PIPER_DEFAULT_VOICE, OK_PIPER_VOICES } from './piper/voices';
