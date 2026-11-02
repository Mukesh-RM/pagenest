/**
 * Voice clone shipping gates (blueprint §10).
 *
 * - **Dev preview:** lite DSP + mock tone — developers only (`VITE_PN_VOICE_CLONE_PREVIEW=1` or Vite dev).
 * - **Phone clone:** SpeechT5 + x-vector on device — post-launch update (`VITE_PN_PHONE_VOICE_CLONE=1` until enabled in production).
 */
export function isVoiceCloneDevPreviewEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_PN_VOICE_CLONE_PREVIEW === '1';
}

export function isPhoneVoiceCloneEnabled(): boolean {
  return import.meta.env.VITE_PN_PHONE_VOICE_CLONE === '1';
}

/** Own-voice listing and helper-engine routing in read-aloud. */
export function isOwnVoicePlaybackEnabled(): boolean {
  return isVoiceCloneDevPreviewEnabled() || isPhoneVoiceCloneEnabled();
}
