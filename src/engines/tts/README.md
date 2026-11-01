# engines/tts

`types.ts` defines the `VoiceEngine` contract (Architect-owned).

## Licensing (Decision 8, docs/LICENSES.md, scripts/audit-models.json)

PageNest does **not** ship GPL phonemizers or blocked stacks:

| Not used | Reason |
|---|---|
| piper1-gpl, piper-phonemize, piper-wasm | GPL / espeak-ng embedded |
| espeak-ng, phonemizer (npm) | GPL-3.0 |
| kokoro-js | Depends on GPL phonemizer |
| en_US-lessac, lessac-derived voices | Blizzard 2013 research-only licence |
| Orpheus 3B | Llama 3.2 Community License |

**Tier 0:** `speech-engine.ts` — Web Speech API (nothing bundled).

**Tier 1:** `piper/` — ONNX Runtime Web (MIT, lazy-loaded WASM from `/ort/`) + rule-based G2P:

- CMU Pronouncing Dictionary snippet (BSD-style, CMU copyright — see LICENSES.md)
- ARPAbet → IPA **character mapping** for Piper `phoneme_id_map` (no espeak-ng code)
- Voices from `piper/voices.ts` only; each id is marked **OK** in `scripts/audit-models.json` (default `en_US-libritts-high`, LibriTTS CC BY 4.0)

**Tier 2 (My voice):** `helper/` — clone from Voice Studio recordings (consent-gated):

- Speaker embedding: `t-neethesh/spkrec-xvect-voxceleb-onnx` (Apache-2.0, lazy ONNX ~2 MB)
- Synthesis: **full** tier runs Xenova SpeechT5 TTS ONNX (encoder + merged decoder + postnet/vocoder, ~180 MB lazy OPFS download) conditioned on your 512-d x-vector; **lite** tier (≤3 GB RAM devices) uses spectral colorization only
- Loaded with **onnxruntime-web** only — no `@huggingface/transformers`, no sharp, no GPL/LGPL phonemizers
- Consent enforced in `helper/consent-gate.ts`; synthesis refuses voices without verified live consent in OPFS manifest

**Tier 2 (future):** `kokoro/kokoro-engine.ts` — stub only until a non-GPL phonemizer exists (Kokoro **weights** are Apache-2.0 but `kokoro-js` is excluded).

Run `node scripts/audit-models.mjs --check` before adding voices or Hugging Face URLs.
