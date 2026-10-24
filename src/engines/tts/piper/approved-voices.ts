/**
 * Piper voices vetted OK for PageNest (see `docs/MODEL_VETTING.md` on audit branch).
 * Do not reference disallowed ids (lessac, libritts_r, amy, ryan, …) outside this deny list.
 */

export type ApprovedPiperVoiceId =
  | 'en_US-libritts-high'
  | 'en_US-kristin-medium'
  | 'en_US-john-medium'
  | 'en_US-norman-medium'
  | 'en_US-ljspeech-high'
  | 'en_US-ljspeech-medium'
  | 'en_GB-cori-high'
  | 'en_GB-cori-medium'
  | 'de_DE-mls-medium'
  | 'fr_FR-mls-medium'
  | 'nl_NL-mls-medium';

export interface ApprovedPiperVoiceMeta {
  readonly id: ApprovedPiperVoiceId;
  /** From voice `.onnx.json` `num_speakers` (rhasspy/piper-voices, verified 2026-10-24). */
  readonly numSpeakers: number;
  readonly castStrategy: 'distinct-voice-ids' | 'speaker-id-or-distinct-voices';
}

/** Voices blocked by vetting — documentation / audit only; never ship or smoke-test these. */
export const FORBIDDEN_PIPER_VOICE_IDS = [
  'en_US-lessac-low', // audit-ignore: deny-list entry (MODEL_VETTING NOT OK)
  'en_US-lessac-medium', // audit-ignore: deny-list entry (MODEL_VETTING NOT OK)
  'en_US-lessac-high', // audit-ignore: deny-list entry (MODEL_VETTING NOT OK)
  'en_US-libritts_r-medium', // audit-ignore: deny-list entry (MODEL_VETTING NOT OK)
  'en_US-amy-low', // audit-ignore: deny-list entry (MODEL_VETTING NOT OK)
  'en_US-amy-medium', // audit-ignore: deny-list entry (MODEL_VETTING NOT OK)
  'en_US-ryan-low', // audit-ignore: deny-list entry (MODEL_VETTING NOT OK)
  'en_US-ryan-medium', // audit-ignore: deny-list entry (MODEL_VETTING NOT OK)
  'en_US-ryan-high', // audit-ignore: deny-list entry (MODEL_VETTING NOT OK)
] as const;

export const APPROVED_PIPER_VOICES: readonly ApprovedPiperVoiceMeta[] = [
  { id: 'en_US-libritts-high', numSpeakers: 904, castStrategy: 'speaker-id-or-distinct-voices' },
  { id: 'en_US-kristin-medium', numSpeakers: 1, castStrategy: 'distinct-voice-ids' },
  { id: 'en_US-john-medium', numSpeakers: 1, castStrategy: 'distinct-voice-ids' },
  { id: 'en_US-norman-medium', numSpeakers: 1, castStrategy: 'distinct-voice-ids' },
  { id: 'en_US-ljspeech-high', numSpeakers: 1, castStrategy: 'distinct-voice-ids' },
  { id: 'en_US-ljspeech-medium', numSpeakers: 1, castStrategy: 'distinct-voice-ids' },
  { id: 'en_GB-cori-high', numSpeakers: 1, castStrategy: 'distinct-voice-ids' },
  { id: 'en_GB-cori-medium', numSpeakers: 1, castStrategy: 'distinct-voice-ids' },
  { id: 'de_DE-mls-medium', numSpeakers: 236, castStrategy: 'speaker-id-or-distinct-voices' },
  { id: 'fr_FR-mls-medium', numSpeakers: 125, castStrategy: 'speaker-id-or-distinct-voices' },
  { id: 'nl_NL-mls-medium', numSpeakers: 52, castStrategy: 'speaker-id-or-distinct-voices' },
];

const approvedById = new Map(APPROVED_PIPER_VOICES.map((v) => [v.id, v]));

export function isApprovedPiperVoiceId(voiceId: string): voiceId is ApprovedPiperVoiceId {
  return approvedById.has(voiceId as ApprovedPiperVoiceId);
}

export function piperVoiceSupportsSpeakerId(voiceId: string): boolean {
  const meta = approvedById.get(voiceId as ApprovedPiperVoiceId);
  return (meta?.numSpeakers ?? 1) > 1;
}

/** Default for manual narration smoke (public-domain LJ Speech, single speaker). */
export const NARRATION_SMOKE_VOICE_ID: ApprovedPiperVoiceId = 'en_US-ljspeech-medium';

/** Hugging Face LFS oid for `en_US-ljspeech-medium.onnx` (verify after download). */
export const NARRATION_SMOKE_VOICE_ONNX_SHA256 =
  '6f52a751e2349abe7a76735eb09dc1875298c77ea2342ffd2fef79ff81b87f22';

/** Bytes for `en_US-ljspeech-medium.onnx` per HF tree API (2026-10-24). */
export const NARRATION_SMOKE_VOICE_ONNX_SIZE_BYTES = 63_531_379;

export function huggingFaceOnnxJsonUrl(voiceId: ApprovedPiperVoiceId): string {
  const segments: Record<ApprovedPiperVoiceId, string> = {
    'en_US-libritts-high': 'en/en_US/libritts/high',
    'en_US-kristin-medium': 'en/en_US/kristin/medium',
    'en_US-john-medium': 'en/en_US/john/medium',
    'en_US-norman-medium': 'en/en_US/norman/medium',
    'en_US-ljspeech-high': 'en/en_US/ljspeech/high',
    'en_US-ljspeech-medium': 'en/en_US/ljspeech/medium',
    'en_GB-cori-high': 'en/en_GB/cori/high',
    'en_GB-cori-medium': 'en/en_GB/cori/medium',
    'de_DE-mls-medium': 'de/de_DE/mls/medium',
    'fr_FR-mls-medium': 'fr/fr_FR/mls/medium',
    'nl_NL-mls-medium': 'nl/nl_NL/mls/medium',
  };
  const path = segments[voiceId];
  return `https://huggingface.co/rhasspy/piper-voices/resolve/main/${path}/${voiceId}.onnx.json`;
}
