/**
 * On-device voice clone stack (lazy download, user-started only).
 * Listed in scripts/audit-models.json — do not add URLs here without vetting.
 */
export const CLONE_STACK_ID = 'pagenest-clone-stack-v1';

export const XVECTOR_MODEL = {
  id: 'spkrec-xvect-voxceleb-onnx',
  license: 'Apache-2.0',
  url: 'https://huggingface.co/t-neethesh/spkrec-xvect-voxceleb-onnx/resolve/main/onnx/model.onnx',
  sizeBytes: 1_900_000,
  dim: 512,
} as const;

export const SPEECHT5_TTS_MODEL = {
  id: 'Xenova/speecht5_tts',
  license: 'MIT',
  repo: 'https://huggingface.co/Xenova/speecht5_tts',
  approxBytes: 120_000_000,
} as const;

export const SPEECHT5_VOCODER_MODEL = {
  id: 'Xenova/speecht5_hifigan',
  license: 'MIT',
  repo: 'https://huggingface.co/Xenova/speecht5_hifigan',
  approxBytes: 55_000_000,
} as const;

export function cloneModelPath(fileName: string): string {
  return `models/${CLONE_STACK_ID}/${fileName}`;
}

export function voiceEmbeddingPath(voiceId: string): string {
  return `voices/${voiceId}/speaker_embedding.f32`;
}

export function voiceReferencePath(voiceId: string): string {
  return `voices/${voiceId}/reference_pcm.f32`;
}
