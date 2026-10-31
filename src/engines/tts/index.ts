import type { VoiceEngine, VoiceEngineId } from './types';
import { createKokoroEngine } from './kokoro/kokoro-engine';
import { createPiperEngine } from './piper/piper-engine';
import { createSpeechEngine } from './speech-engine';

export type { VoiceEngine, VoiceEngineId } from './types';

export function createDefaultVoiceEngine(deps: Parameters<typeof createPiperEngine>[0]): VoiceEngine {
  return createPiperEngine(deps);
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
