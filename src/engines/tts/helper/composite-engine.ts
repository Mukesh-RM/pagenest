import type { VoiceEngine, VoiceInfo, PrepareOptions, SynthesisRequest, SynthesisResult, VoiceAvailability } from '../types';

/** Routes synthesis to Piper premade voices or the on-device clone helper from Voice Studio. */
export function createCompositeVoiceEngine(
  primary: VoiceEngine,
  clone: VoiceEngine,
  isOwnVoiceId: (id: string) => Promise<boolean>,
): VoiceEngine {
  const pick = async (voiceId: string): Promise<VoiceEngine> => ((await isOwnVoiceId(voiceId)) ? clone : primary);

  return {
    id: primary.id,
    tier: primary.tier,
    capabilities: {
      ...primary.capabilities,
      supportsOwnVoice: true,
    },
    async checkAvailability(): Promise<VoiceAvailability> {
      const a = await primary.checkAvailability();
      if (!a.available) return a;
      return clone.checkAvailability();
    },
    async listVoices(language?: string): Promise<readonly VoiceInfo[]> {
      const premade = await primary.listVoices(language);
      const own = await clone.listVoices(language);
      return [...own, ...premade];
    },
    async prepareVoice(voiceId: string, options?: PrepareOptions): Promise<void> {
      await (await pick(voiceId)).prepareVoice(voiceId, options);
    },
    async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
      return (await pick(request.voiceId)).synthesize(request);
    },
    async dispose(): Promise<void> {
      await primary.dispose();
      await clone.dispose();
    },
  };
}
