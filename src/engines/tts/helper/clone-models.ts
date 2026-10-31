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

const HF_TTS = 'https://huggingface.co/Xenova/speecht5_tts/resolve/main';

export const SPEECHT5_TTS_MODEL = {
  id: 'Xenova/speecht5_tts',
  license: 'MIT',
  repo: 'https://huggingface.co/Xenova/speecht5_tts',
  approxBytes: 180_000_000,
} as const;

export const SPEECHT5_VOCODER_MODEL = {
  id: 'Xenova/speecht5_hifigan',
  license: 'MIT',
  repo: 'https://huggingface.co/Xenova/speecht5_hifigan',
  approxBytes: 55_000_000,
} as const;

/** Lazy OPFS filenames + HF URLs (quantized ONNX, MIT). */
export const SPEECHT5_CACHE_FILES = {
  encoder: {
    file: 'speecht5_encoder_quantized.onnx',
    url: `${HF_TTS}/onnx/encoder_model_quantized.onnx`,
    sizeBytes: 88_402_301,
  },
  decoder: {
    file: 'speecht5_decoder_merged_quantized.onnx',
    url: `${HF_TTS}/onnx/decoder_model_merged_quantized.onnx`,
    sizeBytes: 71_087_100,
  },
  postnet: {
    file: 'speecht5_postnet_vocoder_quantized.onnx',
    url: `${HF_TTS}/onnx/decoder_postnet_and_vocoder_quantized.onnx`,
    sizeBytes: 18_251_672,
  },
  tokenizer: {
    file: 'speecht5_tokenizer.json',
    url: `${HF_TTS}/tokenizer.json`,
    sizeBytes: 12_000,
  },
} as const;

export const SPEECHT5_STACK_MARKER = 'stack-ready.txt';

export function cloneModelPath(fileName: string): string {
  return `models/${CLONE_STACK_ID}/${fileName}`;
}

export function voiceEmbeddingPath(voiceId: string): string {
  return `voices/${voiceId}/speaker_embedding.f32`;
}

export function voiceReferencePath(voiceId: string): string {
  return `voices/${voiceId}/reference_pcm.f32`;
}
