export { VoiceStudioApp, type VoiceStudioAppProps, type VoiceStudioServices } from './VoiceStudioApp';
export { LazyVoiceStudioRoot, preloadVoiceStudio } from './lazy-root';
export { buildConsentPhrase, CONSENT_WORDS, type ConsentPhrase } from './consent/phrases';
export { consentPhraseMatches, normalizeSpokenText } from './consent/verify';
export { GUIDED_PROMPTS, type GuidedPrompt } from './prompts/guided-prompts';
export {
  listOwnVoices,
  saveOwnVoicePack,
  deleteOwnVoice,
  readVoiceManifest,
  type VoicePackManifest,
} from './data/voice-pack';
export { exportOwnVoiceZip } from './data/export-pack';
