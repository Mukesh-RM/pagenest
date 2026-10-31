import type { SynthesisRequest, SynthesisResult, VoiceAvailability, VoiceEngine, VoiceInfo } from './types';
import { voiceError } from './errors';

/** Tier 0 fallback: browser speech synthesis (foreground only). */
export function createSpeechEngine(): VoiceEngine {
  return {
    id: 'speech',
    tier: 0,
    capabilities: {
      output: 'live',
      backgroundSafe: false,
      supportsProsody: true,
      supportsEmotion: false,
      supportsOwnVoice: false,
      needsDownload: false,
    },
    async checkAvailability(): Promise<VoiceAvailability> {
      if (typeof speechSynthesis === 'undefined') return { available: false, reason: 'Speech synthesis is not supported here.' };
      return { available: true };
    },
    async listVoices(language?: string): Promise<readonly VoiceInfo[]> {
      if (typeof speechSynthesis === 'undefined') return [];
      const list = speechSynthesis.getVoices();
      return list
        .filter((v) => !language || v.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()))
        .map((v, i) => ({
          id: `speech-${i}-${v.voiceURI}`,
          name: v.name,
          engine: 'speech',
          language: v.lang,
          isOwnVoice: false,
          installed: true,
        }));
    },
    async prepareVoice(): Promise<void> {},
    async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
      if (typeof speechSynthesis === 'undefined') throw voiceError('unavailable', 'Speech synthesis is not supported here.');
      await speak(request);
      return { kind: 'live' };
    },
    async dispose(): Promise<void> {
      speechSynthesis?.cancel();
    },
  };
}

function speak(request: SynthesisRequest): Promise<void> {
  return new Promise((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(request.text);
    u.lang = request.language;
    u.rate = request.delivery.rate;
    u.pitch = 1 + request.delivery.pitch / 12;
    u.volume = Math.min(1, request.delivery.volume);
    u.onend = () => resolve();
    u.onerror = () => reject(voiceError('failed', 'Speech synthesis failed.'));
    speechSynthesis.speak(u);
  });
}
