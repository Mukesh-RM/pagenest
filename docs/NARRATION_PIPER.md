# Narration Piper spike (non-GPL path)

**Branch:** `feature/narration-piper`  
**Depends on:** cherry-pick `2fcbaca` (Speech tier‑0 + `model-download` types) from `feature/narration-spike` — not yet on `main` at spike start.  
**Decision 8:** PageNest stays **MIT**; no eSpeak, piper-phonemize, or GPL WASM in the bundle.

## Verdict

**Workable with limits.**

- **Piper inference from phoneme ids only** is implemented (worker + ORT Web load at runtime). Verified **outside the repo** with Python `onnxruntime` on `en_US-amy-low` (LibriVox-derived Piper voice, MIT per Piper voice policy — Auditor must confirm card before ship).
- **English G2P** uses **CMUdict + heteronym list (50+) + rule-based LTS** (replaces letter spelling). On 50 evaluation sentences (after LTS): **OOV token rate still ~3.8%** (dict misses — names/brands), **phoneme_id_map coverage 100%**, **0 unknown IPA symbols**; **LTS handles all 13 former spell-fallback tokens** with grapheme rules instead of letter names.
- **Limits:** G2P is **not** identical to eSpeak (no GPL reference in repo). Heteronym accuracy **≥80%** on a 10-case hand-built set (`heteronym-eval.test.ts`). Multi-language needs other dictionaries/rules.

---

## (a) Piper inference worker

| Piece | Path |
|---|---|
| Voice config parser | `src/engines/tts/piper/piper-voice-config.ts` |
| Phoneme id encoder | `src/engines/tts/piper/phoneme-ids.ts` |
| ORT-agnostic inference | `src/engines/tts/piper/piper-inference.ts` |
| Worker protocol | `src/engines/tts/piper/piper-worker-protocol.ts` |
| Sentence queue + cancel | `src/engines/tts/piper/piper-synth-queue.ts` |
| Worker entry | `src/engines/tts/piper/piper-synth.worker.ts` |

**Inputs (ONNX):** `input` (int64 `[1, N]`), `input_lengths`, `scales` `[noise, length, noise_w]` from config, optional `sid` for multi-speaker voices.

**Output:** `Float32Array` PCM + `sampleRate` + `durationSec` (Opus encode deferred to Phase 4).

**ORT Web:** `onnxruntime-web@1.22.0` (MIT, in `package.json`). WASM paths set via `ortWasmBaseUrl` at init — **not** in the Vite shell bundle; worker dynamic-imports ORT.

**Tests:** `piper-inference.test.ts` (fake session), `piper-synth-queue.test.ts`.

### Real ONNX sanity check (transient, not in repo)

Run on the cloud agent VM with `pip install onnxruntime` (not a project dependency):

- Model: [en_US-amy-low.onnx](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/amy/low) (~60 MB download).
- Phoneme string `həlˈoʊ` encoded with the voice `phoneme_id_map`.
- Result: **6656 samples @ 22050 Hz (~0.42 s)**, all finite, peak ~0.40 — plausible speech-length audio.

This confirms the **phoneme-id contract** matches Piper ONNX; browser ORT Web path uses the same tensor names via `runPiperInference`.

---

## (b) Permissive English G2P

| Piece | Path |
|---|---|
| CMUdict parser (compact + classic) | `src/engines/tts/g2p/cmu-dict.ts` |
| Normalizer | `src/engines/tts/g2p/normalize.ts` |
| ARPAbet → IPA | `src/engines/tts/g2p/arpabet-to-ipa.ts` |
| English LTS (OOV) | `src/engines/tts/g2p/english-lts.ts` |
| Heteronyms (50+) | `src/engines/tts/g2p/heteronyms.ts` |
| Text → phoneme ids | `src/engines/tts/g2p/english-g2p.ts` |
| 50-sentence eval set | `src/engines/tts/g2p/g2p-eval-sentences.ts` |
| CI metrics | `src/engines/tts/g2p/g2p-quality.test.ts` |

### Data licenses (verified links)

| Data | License | Link | Verified |
|---|---|---|---|
| CMUdict | Unrestricted use; **attribution requested** (not BSD, but permissive for redistribution) | [cmudict README](https://raw.githubusercontent.com/cmusphinx/cmudict/master/README) | HTTP 200 |
| Piper voice config / weights | **Per voice** on Hugging Face | [libritts_r medium](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/libritts_r/medium) | HTTP 200 |
| en_US-amy-low (sanity ONNX) | Piper / LibriVox lineage — **Auditor VERIFY** | [amy/low](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/amy/low) | HTTP 200 |

**Not in the app bundle:** full CMUdict is loaded **on demand** (OPFS or user download); tests fetch from GitHub at runtime.

### 50-sentence objective check (Vitest)

| Metric | Before (spell fallback) | After (LTS + heteronyms) |
|---|---:|---:|
| OOV dict miss rate | 3.81% (13/341) | ~3.8% (same misses, better phones) |
| `phoneme_id_map` coverage | 100% | 100% |
| Unknown IPA symbols | 0 | 0 |
| OOV handling | Letter names (`rules-fallback`) | **LTS grapheme rules** + heteronym context |

Latest CI log fields: `ltsFallbacks`, `heteronymHits`, `baselineSpellOOVRate: 0.0381` (see `g2p-quality.test.ts`).

- **OOV examples:** proper names (`NVIDIA`, `Schwarzenegger`, …) still absent from CMUdict but pronounced via **LTS**, not spelling.
- **eSpeak reference:** `espeak-ng` was **not installed** on the spike VM; no phoneme-sequence A/B against eSpeak in CI. Optional manual check: install eSpeak **outside** the repo only for comparison (GPL — never ship).

### Phoneme symbol set

Aligned to Piper `phoneme_type: "espeak"` maps in voice JSON (e.g. `en_US-libritts_r-medium.onnx.json` on [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices)). Encoder wraps with `_`, `^`, …, `$`, `_` per `encodePhonemeString`.

---

## (c) OPFS model download

| Piece | Path |
|---|---|
| HTTP Range fetch | `src/engines/tts/download/range-fetch.ts` |
| SHA-256 + checkpoint paths | `src/engines/tts/download/opfs-voice-storage.ts` |
| State machine runner | `src/engines/tts/download/model-download-runner.ts` |
| Worker glue | `src/engines/tts/download/model-download.worker.ts` |
| Test double storage | `src/engines/tts/download/memory-voice-storage.ts` |

**Behaviour:** `HEAD` / `Content-Length`, resume with `Range` + `If-Range`/`ETag`, streaming SHA-256 verify, checkpoint files, cancel, delete, `navigator.storage.estimate()` before consent, `navigator.storage.persist()` request.

**No CDN URL in repo:** `baseUrl` is **injected** into `ModelDownloadRunner` / worker messages after Auditor approval.

**Tests:** `range-fetch.test.ts` and `model-download-runner.test.ts` use **local Node `http` servers** with Range support.

---

## License table additions

| Component | License | Link |
|---|---|---|
| onnxruntime-web 1.22.0 | MIT | [LICENSE](https://raw.githubusercontent.com/microsoft/onnxruntime/main/LICENSE) |
| CMUdict | Unrestricted (+ attribution request) | [README](https://raw.githubusercontent.com/cmusphinx/cmudict/master/README) |
| rhasspy/piper-voices (per voice) | MIT / CC / dataset-specific | [HF repo](https://huggingface.co/rhasspy/piper-voices) |

---

## Risks

| Risk | Mitigation |
|---|---|
| G2P ≠ eSpeak quality | User testing; heteronym rules; optional future ML G2P (permissive weights only) |
| OOV spell mode | Highlight in UI; expand dict; personal word list in OPFS |
| ORT WASM size / cold start | Self-host WASM; worker warmup; Piper default not Kokoro |
| Voice license per HF card | Auditor gate before `connect-src` + catalog URLs |
| `package.json` adds ORT | Already in `audit-planned.json` as OK |

---

## Manual browser smoke

See `tests/manual/narration/README.md`. Run: `npm run smoke:narration` (not CI). Model under `.models/narration/` (git-ignored).

**VM run (2026-10-24):** `en_US-amy-low` in Chromium — `durationSec≈2.83`, `inferSec≈0.87`, **RTF≈0.31**, `peak≈0.44`, finite audio ✓.

---

## Open items for other owners

1. **Shell/PWA:** self-host ORT `.wasm` + approved model CDN in `connect-src`.
2. **Library:** optional reuse of `FileStore` instead of parallel OPFS helper (avoid duplication).
3. **Architect:** wire `piper-synth.worker` + download worker into services; `VoiceEngine` implementation for Piper.
4. **Auditor:** sign off `en_US-libritts_r` / `amy-low` cards and CMUdict attribution on licenses screen.
