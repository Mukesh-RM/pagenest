import type { PageNestDB } from '@/data/db';
import type { FileStore } from '@/data/opfs';
import type { VoiceEngine, VoiceEngineId } from './types';
import { createCloneEngine } from './helper/clone-engine';
import { createCloneModelStore } from './helper/clone-model-store';
import { canUseClonedVoice } from './helper/consent-gate';
import { createKokoroEngine } from './kokoro/kokoro-engine';
import { createPiperEngine } from './piper/piper-engine';
import { piperVoiceById } from './piper/voices';
import { createSpeechEngine, isSpeechVoiceId } from './speech-engine';

export type { VoiceEngine, VoiceEngineId } from './types';

export function createDefaultVoiceEngine(): VoiceEngine {
  return createSpeechEngine();
}

export function createNarrationVoiceEngine(
  piperDeps: Parameters<typeof createPiperEngine>[0],
  cloneDeps: { readonly db: PageNestDB; readonly files: FileStore; readonly createCloneWorker?: () => Worker },
): VoiceEngine {
  const speech = createSpeechEngine();
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

  const pick = async (voiceId: string): Promise<VoiceEngine> => {
    if (isSpeechVoiceId(voiceId)) return speech;
    if (await canUseClonedVoice(cloneDeps.db, cloneDeps.files, voiceId)) return clone;
    if (piperVoiceById(voiceId)) return piper;
    return speech;
  };

  return {
    id: 'speech',
    tier: 0,
    capabilities: {
      output: 'live',
      backgroundSafe: false,
      supportsProsody: true,
      supportsEmotion: false,
      supportsOwnVoice: true,
      needsDownload: false,
    },
    async checkAvailability() {
      const s = await speech.checkAvailability();
      if (!s.available) return s;
      return piper.checkAvailability();
    },
    async listVoices(language?: string) {
      const [device, own, hd] = await Promise.all([
        speech.listVoices(language),
        clone.listVoices(language),
        piper.listVoices(language),
      ]);
      return [...device, ...own, ...hd];
    },
    async prepareVoice(voiceId: string, options?) {
      await (await pick(voiceId)).prepareVoice(voiceId, options);
    },
    async synthesize(request) {
      return (await pick(request.voiceId)).synthesize(request);
    },
    async dispose() {
      await speech.dispose();
      await piper.dispose();
      await clone.dispose();
    },
  };
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
      return createSpeechEngine();
  }
}

export { PIPER_DEFAULT_VOICE, OK_PIPER_VOICES } from './piper/voices';
export {
  createSpeechEngine,
  isSpeechVoiceId,
  pickDefaultSpeechVoice,
  speechVoiceIdFrom,
  waitForSpeechVoices,
} from './speech-engine';
