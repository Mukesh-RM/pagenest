/** Pinned voice bundle revision (scripts/audit-models.json, public/models/piper/manifest.json). */
export const PIPER_VOICES_REVISION = '5041a7a49ae5b3a0f30e6837769eb03fdbb231bd';

/** Cloudflare Pages max asset size; large ONNX files are split into parts under this size. */
export const PIPER_MODELS_CHUNK_BYTES = 24 * 1024 * 1024;

/** Same-origin root for Piper ONNX + config (deploy with scripts/sync-piper-models.mjs). */
export const PIPER_MODELS_ROOT = `/models/piper/${PIPER_VOICES_REVISION}`;

/** Voices marked OK in scripts/audit-models.json that PageNest may offer (English defaults first). */
export const OK_PIPER_VOICES = [
  {
    id: 'en_US-libritts-high',
    name: 'LibriTTS (US, high)',
    language: 'en-US',
    hfPath: 'en/en_US/libritts/high',
    sizeBytes: 136_673_811,
    sha256: '9127a559e11603f10b366d1a20ac7426826081dbc521de4c2420c57728d73f0f',
    dataset: 'LibriTTS (CC BY 4.0)',
  },
  {
    id: 'en_US-kristin-medium',
    name: 'Kristin (US)',
    language: 'en-US',
    hfPath: 'en/en_US/kristin/medium',
    sizeBytes: 63_531_379,
    sha256: '5849957f929cbf720c258f8458692d6103fff2f0e3d3b19c8259474bb06a18d4',
    dataset: 'Kristin (permissive)',
  },
  {
    id: 'en_US-john-medium',
    name: 'John (US)',
    language: 'en-US',
    hfPath: 'en/en_US/john/medium',
    sizeBytes: 63_531_379,
    sha256: '789c6c875726e627ddee93d51d8727859abe9c091c3d141591f4b83c2072e988',
    dataset: 'John (permissive)',
  },
  {
    id: 'en_US-ljspeech-medium',
    name: 'LJSpeech (US)',
    language: 'en-US',
    hfPath: 'en/en_US/ljspeech/medium',
    sizeBytes: 63_531_379,
    sha256: '6f52a751e2349abe7a76735eb09dc1875298c77ea2342ffd2fef79ff81b87f22',
    dataset: 'LJ Speech (public domain)',
  },
  {
    id: 'en_GB-cori-high',
    name: 'Cori (UK, high)',
    language: 'en-GB',
    hfPath: 'en/en_GB/cori/high',
    sizeBytes: 114_219_352,
    sha256: '470b4dd634c98f8a4850d7626ffc3dfc90774628eeef6605a6dd8f88f30a5903',
    dataset: 'Cori (permissive)',
  },
] as const;

export type OkPiperVoiceId = (typeof OK_PIPER_VOICES)[number]['id'];

export const PIPER_DEFAULT_VOICE: OkPiperVoiceId = 'en_US-libritts-high';

export function piperVoiceById(id: string) {
  return OK_PIPER_VOICES.find((v) => v.id === id);
}

export function partCountForVoice(sizeBytes: number): number {
  return Math.max(1, Math.ceil(sizeBytes / PIPER_MODELS_CHUNK_BYTES));
}

/** Closed set of download URLs on this origin; only OK voices above may be requested. */
export function modelUrls(voiceId: string): { weights: string; config: string; partCount: number } | undefined {
  const v = piperVoiceById(voiceId);
  if (!v) return undefined;
  const base = `${PIPER_MODELS_ROOT}/${v.hfPath}`;
  const partCount = partCountForVoice(v.sizeBytes);
  return {
    weights: `${base}/${voiceId}.onnx`,
    config: `${base}/${voiceId}.onnx.json`,
    partCount,
  };
}

export function modelPartUrl(voiceId: string, partIndex: number): string | undefined {
  const v = piperVoiceById(voiceId);
  if (!v) return undefined;
  const base = `${PIPER_MODELS_ROOT}/${v.hfPath}`;
  return `${base}/${voiceId}.onnx.part${String(partIndex).padStart(2, '0')}`;
}
