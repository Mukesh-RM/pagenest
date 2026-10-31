/** Pinned Hugging Face revision for rhasspy/piper-voices (scripts/audit-models.json). */
export const PIPER_VOICES_REVISION = '5041a7a49ae5b3a0f30e6837769eb03fdbb231bd';

export const PIPER_VOICES_BASE =
  'https://huggingface.co/rhasspy/piper-voices/resolve/5041a7a49ae5b3a0f30e6837769eb03fdbb231bd';

/** Voices marked OK in scripts/audit-models.json that PageNest may offer (English defaults first). */
export const OK_PIPER_VOICES = [
  {
    id: 'en_US-libritts-high',
    name: 'LibriTTS (US, high)',
    language: 'en-US',
    hfPath: 'en/en_US/libritts/high',
    sizeBytes: 136_673_811,
    dataset: 'LibriTTS (CC BY 4.0)',
  },
  {
    id: 'en_US-kristin-medium',
    name: 'Kristin (US)',
    language: 'en-US',
    hfPath: 'en/en_US/kristin/medium',
    sizeBytes: 63_201_024,
    dataset: 'Kristin (permissive)',
  },
  {
    id: 'en_US-john-medium',
    name: 'John (US)',
    language: 'en-US',
    hfPath: 'en/en_US/john/medium',
    sizeBytes: 63_201_024,
    dataset: 'John (permissive)',
  },
  {
    id: 'en_US-ljspeech-medium',
    name: 'LJSpeech (US)',
    language: 'en-US',
    hfPath: 'en/en_US/ljspeech/medium',
    sizeBytes: 63_201_024,
    dataset: 'LJ Speech (public domain)',
  },
  {
    id: 'en_GB-cori-high',
    name: 'Cori (UK, high)',
    language: 'en-GB',
    hfPath: 'en/en_GB/cori/high',
    sizeBytes: 136_673_811,
    dataset: 'Cori (permissive)',
  },
] as const;

export type OkPiperVoiceId = (typeof OK_PIPER_VOICES)[number]['id'];

export const PIPER_DEFAULT_VOICE: OkPiperVoiceId = 'en_US-libritts-high';

export function piperVoiceById(id: string) {
  return OK_PIPER_VOICES.find((v) => v.id === id);
}

/** Closed set of download URLs; only OK voices above may be requested. */
export function modelUrls(voiceId: string): { weights: string; config: string } | undefined {
  const v = piperVoiceById(voiceId);
  if (!v) return undefined;
  const base = `${PIPER_VOICES_BASE}/${v.hfPath}`;
  return {
    weights: `${base}/${voiceId}.onnx`,
    config: `${base}/${voiceId}.onnx.json`,
  };
}
