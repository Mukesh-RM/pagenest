# Narration spike (Phase 4 prep)

**Branch:** `feature/narration-spike`  
**Owner:** Narration bot (`src/features/narration`, `src/engines/tts`)  
**Status:** Spike complete — SpeechSynthesis tier‑0 engine implemented; Piper/Kokoro blocked on GPL phonemizer decision (see [Decision 8](../DECISIONS.md)).

## Recommendation (short)

1. **Ship foreground read-aloud now** with the implemented **Speech Synthesis** `VoiceEngine` (`SpeechSynthesisVoiceEngine` + `SpeechNarrationSession`) for previews, accessibility fallbacks, and devices without downloaded models. It is **not** background-safe (screen lock / hidden tab).
2. **Production read-aloud (Phase 4 gate)** must follow blueprint §9.1: synthesize **PCM/Opus in a worker** with **ONNX Runtime Web**, cache in OPFS, play through the **same HTML audio path as audiobooks** so playback continues with the screen off.
3. **Default on-device engine:** **Piper (tier 1)** — best published mobile RTF for VITS-class voices and aligns with blueprint §9.3. Use **per-voice LibriTTS / libritts_r checkpoints** only; never ship `en_US-lessac` (Blizzard 2013, research-only) per Decision 8.
4. **Optional tier 2:** **Kokoro-82M** (Apache-2.0 weights) for higher quality where CPU/WebGPU budget allows; treat as a larger download and slower on many Android devices (field medians below).
5. **GPL blocker (Decision 8):** Do **not** merge **eSpeak NG** or **piper-phonemize** (GPL-3.0-or-later) or **kokoro-js’s bundled phonemizer WASM** into `main` until either (a) a **non-GPL G2P path** is proven (phoneme input to Piper without espeak in the bundle, or a permissive phonemizer), or (b) Mukeshh records **relicensing PageNest to GPL-3.0-or-later** in `DECISIONS.md`.
6. **Next engineering steps:** Piper worker that accepts **precomputed phoneme ids** (no espeak in app) + model download flow below; parallel spike on permissive G2P (e.g. language-specific MIT models, dictionary-only paths, or server-assisted phonemes only for Helper — not for core offline PWA).

---

## License table

Real-time factor (RTF) = synthesis time ÷ audio duration; **&lt; 1** means faster than real time. Sizes are **download-on-demand** (never in the app shell); verify on Hugging Face before adding a voice.

| Component | Role | License | Model / weights license | Typical download size | Mid-range phone RTF | Background / screen off | License text (verified) |
|---|---|---|---|---:|---|---|---|
| **Web Speech API** (`speechSynthesis`) | Tier 0 fallback | *Browser implementation* (no extra deps) | N/A (OS voices) | 0 | *N/A* (live playback, not batch RTF) | **No** — pauses or stops when tab hidden / screen locked on most mobile browsers | [MDN SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) (200) |
| **rhasspy/piper** (archived) | Reference Piper 1.0 codebase | **MIT** | Voice `.onnx` per voice card (many **CC BY** / dataset-specific; audit each) | ~15–80 MB per voice (varies by quality) | See Piper rows below | Yes **if** audio is rendered to buffer (not live API) | [LICENSE.md](https://raw.githubusercontent.com/rhasspy/piper/master/LICENSE.md) (200) |
| **OHF-Voice/piper1-gpl** (active Piper 1.x) | Current Piper training/runtime lineage | **GPL-3.0-or-later** | Same per-voice rules | Same order of magnitude | Same inference core | Yes (buffer path) | [COPYING](https://raw.githubusercontent.com/OHF-Voice/piper1-gpl/main/COPYING) (200) |
| **piper-phonemize** + **eSpeak NG** | Text → phonemes for Piper in browser ports | **GPL-3.0-or-later** (eSpeak NG; phonemize is a combined work) | eSpeak **language data** GPL | WASM data often **1–3 MB** per language slice + voice ONNX | Phonemize cost separable from VITS (see wide.video notes) | N/A (G2P stage) | eSpeak: [COPYING](https://raw.githubusercontent.com/espeak-ng/espeak-ng/master/COPYING) (200). piper-phonemize: **no `LICENSE` at `master/LICENSE` (404)** — treat as **GPL with eSpeak**; upstream repo: [rhasspy/piper-phonemize](https://github.com/rhasspy/piper-phonemize) |
| **ONNX Runtime Web** | Run Piper/Kokoro ONNX in worker | **MIT** | N/A | WASM **~several MB** (loaded once per engine, not in shell today) | Depends on model | Yes (buffer path) | [LICENSE](https://raw.githubusercontent.com/microsoft/onnxruntime/main/LICENSE) (200) |
| **Piper VITS voice (ONNX)** | Tier 1 default | Inference stack MIT/GPL per row above | **Per voice** (e.g. LibriTTS-derived MIT Piper voices) | **~15–80 MB** per voice (blueprint §9.3 “tens of MB”) | **Piper median ~0.25 Android / ~0.12 iOS** (Éist field data, sherpa-onnx); **~1.1 RTF** Chrome Android demo (wide.video issue, VCTK); **~0.79** desktop Firefox same thread | Yes (buffer + audio element) | Voices: Hugging Face `rhasspy/piper-voices` cards (audit each). Benchmarks: [Éist Piper](https://eist.app/research/on-device-tts-benchmarks/piper) (200), [piper#352](https://github.com/rhasspy/piper/issues/352) (200) |
| **Kokoro-82M** model weights | Tier 2 optional | N/A | **Apache-2.0** | **~80–300 MB** class (model + voice pack; quantisation changes size) | **Median ~3.5 Android / ~1.3 iOS** fp32 field (Éist); **~0.31 RTF** Pixel 10 Pro XL quantised CPU ([HF card](https://huggingface.co/ductai199x/sidecoach-kokoro-fast)); emulator **~0.58** ([Soniqo](https://soniqo.audio/benchmarks/android)) | Yes (buffer path) | [Kokoro-82M HF](https://huggingface.co/hexgrad/Kokoro-82M) (200), [LICENSE](https://raw.githubusercontent.com/hexgrad/kokoro/main/LICENSE) (200) |
| **kokoro-js** (npm) | Kokoro in browser via Transformers.js | **Apache-2.0** (package) | Weights separate (Apache-2.0) | Pulls ONNX + **phonemizer WASM** on demand | Similar to Kokoro + ORT overhead | Yes if buffer path | Package metadata: [registry.npmjs.org/kokoro-js](https://registry.npmjs.org/kokoro-js/latest) (200). **npm.com HTML returned 403 to bot** — use registry API. Bundled **eSpeak**: GPL (see MafiaVoice licence breakdown). |
| **phonemizer.js** (Transformers.js ecosystem) | G2P inside kokoro-js | **Apache-2.0** wrapper | Bundled **eSpeak NG GPL** | Part of kokoro-js download | N/A | N/A | [LICENSE](https://github.com/xenova/phonemizer.js/blob/main/LICENSE) (200); GPL concern: [issue #6](https://github.com/xenova/phonemizer.js/issues/6) |

### Links not fully verified

| Item | Note |
|---|---|
| `piper-phonemize` SPDX file at `master/LICENSE` | **404** on GitHub raw; use repo root and eSpeak COPYING until upstream documents otherwise. |
| `www.npmjs.com/package/kokoro-js` | **403** to automated fetch; **registry.npmjs.org** works. |
| Exact eSpeak commit inside kokoro-js / piper WASM ports | **Not verified** in this spike; GPL obligations still apply to distributed binaries. |

---

## Real-time factor summary (published sources only)

| Engine | Source | RTF | Notes |
|---|---|---:|---|
| Piper (VCTK), Firefox desktop | [rhasspy/piper#352](https://github.com/rhasspy/piper/issues/352) | **0.79** | Community demo, PC |
| Piper (VCTK), Chrome Android | same issue | **1.1** | Slightly slower than real time |
| Piper, WASM split phonemize+ORT | [piper.wide.video](https://piper.wide.video) / issue comment | **4–8× faster CPU** vs monolithic WASM | Relative speedup, not absolute RTF |
| Piper, Éist production (Android) | [Éist](https://eist.app/research/on-device-tts-benchmarks/piper) | **median 0.247** | sherpa-onnx 1.12.40 |
| Piper, Éist production (iOS) | same | **median 0.115** | |
| Kokoro fp32, Éist (Android) | [Éist Kokoro](https://eist.app/research/on-device-tts-benchmarks/kokoro) | **median 3.48** | Often slower than real time on Android |
| Kokoro quantised, Pixel 10 Pro XL | [sidecoach-kokoro-fast](https://huggingface.co/ductai199x/sidecoach-kokoro-fast) | **0.31** | ORT 1.30, 5 threads |
| Kokoro, Android emulator CPU | [Soniqo](https://soniqo.audio/benchmarks/android) | **0.58** | NNAPI faster on hardware (estimate in doc) |

Blueprint target (§16): Piper **faster than real time** on a mid-range phone — Éist Piper medians support this on many devices; **Kokoro fp32 often does not on Android** without quantisation or turbo variants.

---

## Screen-off / background audio limits

| Option | Screen locked / tab in background | Mitigation in PageNest |
|---|---|---|
| **SpeechSynthesis** | **Unreliable** — iOS Safari and Chrome Android commonly **pause or stop** utterances; no Media Session control of TTS stream | Tier 0 only; document in UI; use for short previews |
| **Piper / Kokoro → Opus → `<audio>`** | **Same as audiobooks** when using Media Session + installed PWA (Phase 3/4 integration) | Default production path |
| **WebGPU for ORT** | Does not change audio policy; may reduce CPU drain during pre-render | Optional when available |

Chrome **~15 s utterance limit:** long sentences are split in `chunkForUtteranceLimit` (`CHROME_UTTERANCE_CHAR_LIMIT = 180`) inside `speech-synthesis-adapter.ts`.

---

## Highlight follow-along contract

Types: `src/features/narration/highlight-contract.ts`.

- Events are **`NarrationHighlightEvent`**: `sentenceIndex`, `textStart` / `textEnd` (UTF-16 offsets in the passage string), `granularity` (`sentence` | `character`).
- **Sentence-level** events fire when each sentence starts.
- **Character-level** events fire when `speechSynthesis` emits `boundary` with `name` `word` or `sentence` (browser-dependent); offsets are mapped into the sentence via `charOffsetInSentence` + `charLength`.
- When boundaries are missing (some Android builds), UI should **highlight the whole sentence** only.

`SpeechNarrationSession` wires segmenter → adapter → highlight callbacks.

---

## Model download flow (design — no network code in repo yet)

**Goals:** show **size before download**, **HTTP Range** resume, **SHA-256 integrity**, store under **OPFS** (`voices/` tree, not service worker cache per §14), **user-cancelled**, **quota-aware**, **deletable**.

### UX sequence

1. User picks a voice → UI reads `VoiceInfo.sizeBytes` and `installed`.
2. `prepareVoice(voiceId, { allowDownload: true })` (future Piper/Kokoro engines) transitions the **model download state machine** (`src/engines/tts/model-download.ts`):
   - `idle` → `checking-quota` → `awaiting-user-consent` (show **total bytes** and free space) → `downloading` → `verifying` → `installed`.
3. On failure: `failed` with plain-words `message` (`quota-exceeded`, `integrity`, `cancelled`, `network`).
4. Delete voice: `delete-requested` → remove OPFS files + checkpoint → `idle`.

### Storage layout (proposed)

```
OPFS:/voices/{engine}/{voiceId}/
  manifest.json          # VoiceModelManifest
  model.onnx             # or multiple shards
  config.json
  .checkpoint.json       # ModelDownloadCheckpoint (byte offset, etag)
```

### HTTP / integrity (worker implementation later)

- `HEAD` or manifest `Content-Length` for total size.
- `GET` with `Range: bytes=` resume from `ModelDownloadCheckpoint.receivedBytes`.
- After each file: SHA-256 compare to `VoiceModelIntegrity.files[path]`.
- `navigator.storage.estimate()` before consent; block with `quota-exceeded` if `totalBytes > quota`.

### Typed state machine

Pure reducer: `transitionModelDownload(state, action)` — actions include `user-confirmed`, `progress`, `verify-succeeded`, `user-cancelled`, `delete-completed`. Unit tests in `model-download.test.ts`.

**No fetch URLs or CDN hosts** are hard-coded in this spike (Decision 4: Shell/PWA will extend `connect-src` after Auditor approves hosts).

---

## Code delivered in this spike

| Path | Purpose |
|---|---|
| `src/engines/tts/speech-synthesis-engine.ts` | `VoiceEngine` tier 0 |
| `src/engines/tts/speech-synthesis-adapter.ts` | Utterance chunking, boundaries, injectable port for tests |
| `src/engines/tts/model-download.ts` | Download state machine types + reducer |
| `src/features/narration/sentence-segmenter.ts` | `Intl.Segmenter` + rule fallback |
| `src/features/narration/speech-narration-session.ts` | Pause/resume/stop/seek/rate/highlight |
| `src/features/narration/highlight-contract.ts` | Event contract |
| `*.test.ts` | Vitest coverage with fake `speechSynthesis` |

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| GPL in phonemizer/espeak | MIT app cannot ship default Piper/Kokoro JS stacks blindly | Decision 8 path; phoneme-input-only Piper; or GPL relicense |
| Per-voice dataset licenses | Legal | Auditor checklist per HF voice card; ban lessac |
| Kokoro Android RTF | Chapter pre-render too slow | Default Piper; optional Kokoro; quantised models |
| ORT WASM size + COOP/COI | Bundle budget / threads | Keep ORT in worker; COI off until needed (Decision 4) |
| SpeechSynthesis UX | Users expect background read-aloud | Clear labelling; drive install + buffer engine |
| Storage eviction | Models deleted | Persist prompt + backup; re-download with resume |

---

## Open issues for Casey / other bots

1. **Architect:** wire `VoiceEngine` registry in app shell when Phase 4 UI lands.
2. **Shell/PWA:** `connect-src` for model CDN after license + host approval.
3. **Audio:** route Opus narration buffers through `AudioController` + Media Session.
4. **Auditor:** sign off non-GPL G2P strategy or GPL relicense before merging ONNX deps to `main`.
