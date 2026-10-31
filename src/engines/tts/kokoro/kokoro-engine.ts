import type { VoiceAvailability, VoiceEngine, VoiceInfo } from '../types';

/** Tier 2 Kokoro placeholder: weights are OK but kokoro-js is blocked (Decision 8). */
export function createKokoroEngine(): VoiceEngine {
  return {
    id: 'kokoro',
    tier: 2,
    capabilities: {
      output: 'buffer',
      backgroundSafe: true,
      supportsProsody: true,
      supportsEmotion: true,
      supportsOwnVoice: false,
      needsDownload: true,
    },
    async checkAvailability(): Promise<VoiceAvailability> {
      return {
        available: false,
        reason: 'Kokoro is not enabled yet. PageNest needs a permissive phoneme engine before Kokoro can ship.',
      };
    },
    async listVoices(): Promise<readonly VoiceInfo[]> {
      return [];
    },
    async prepareVoice(): Promise<void> {
      throw new Error('Kokoro is not available in this build.');
    },
    async synthesize(): Promise<never> {
      throw new Error('Kokoro is not available in this build.');
    },
    async dispose(): Promise<void> {},
  };
}
