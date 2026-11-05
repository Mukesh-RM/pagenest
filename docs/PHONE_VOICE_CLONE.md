# On-phone voice clone (post-launch)

Owner rule: **train and run on the phone**, free, offline after a one-time model download. Route A (My Voice Pack on PC/Colab → Piper import) stays an **optional extra**, not the primary path.

## Shipping flags

| Flag | Purpose |
| --- | --- |
| *(none)* | Launch build: no **Train on device**, no **My voice** in read-aloud (`clone-shipping.ts`). |
| `VITE_PN_VOICE_CLONE_PREVIEW=1` | Dev/e2e only: lite DSP + mock tone (not real cloning). |
| `VITE_PN_PHONE_VOICE_CLONE=1` | Post-launch product build: real x-vector + SpeechT5 path. |

## User flow (phone flag on)

1. **Voice Studio** — consent phrase + guided recordings (unchanged).
2. **Download voice models** — one-time consent dialog (~180 MB SpeechT5 quantized ONNX + ~1.9 MB x-vector). Files land in OPFS under `models/pagenest-clone-stack-v1/`; consent recorded in IndexedDB (`phoneCloneModelDownloadConsent`).
3. **Prepare** — `preparePhoneVoiceOnDevice` runs `clone-engine.prepareVoice(..., { allowDownload: true })`: real x-vector embedding from WAVs, profile in `voices/<id>/speaker_embedding.f32`.
4. **Read-aloud** — pick **My voice** in narration; chapter prep reuses cached models (offline). Lite mock tone is **disabled** when the phone flag is on (`clone-runtime.ts`).

## Code map

| Piece | Path |
| --- | --- |
| Gates | `src/engines/tts/helper/clone-shipping.ts` |
| Model URLs / OPFS paths | `src/engines/tts/helper/clone-models.ts` |
| Inference | `src/engines/tts/helper/clone-engine.ts`, `clone-runtime.ts`, `clone.worker.ts` |
| Voice Studio prepare UI | `VoiceStudioApp.tsx`, `prepare-phone-voice.ts`, `phone-clone-consent.ts` |

## Benchmark (Pixel 7 / iPhone-class, honest)

Cloud CI does **not** run full ~180 MB downloads or WebGPU on real phones. Use a **phone-flag preview build** on hardware:

```bash
VITE_PN_PHONE_VOICE_CLONE=1 npm run build && npm run preview
# Voice Studio → record → Download voice models → read a chapter with My voice
```

**What to measure**

| Step | Expected class (WASM on mid phone) | Usability note |
| --- | --- | --- |
| One-time download | 2–8 min on Wi‑Fi (178 MB + 1.9 MB) | User must stay on screen; show progress (prepareVoice `onProgress`). |
| x-vector embed (5–6 clips) | ~5–30 s total | Acceptable one-time after record. |
| SpeechT5 warm + first sentence | 15–90 s first time | Heavy WASM; WebGPU when ORT exposes it helps. |
| Steady sentence synth | ~2–15 s / sentence | Chapter read-aloud may feel **slow but usable** on Pixel 7; older iPhones may need “Expressive off” and shorter chapters. |
| Offline after cache | Same as above, no network | OPFS marker `stack-ready.txt` must exist. |

**Quality:** With full stack + real embedding, output is **SpeechT5 conditioned on x-vector** — intelligible and owner-like timbre, not broadcast studio. It is **not** Piper/Route A quality. Lite preview (dev flag) remains a sine mock and must never ship to users.

**Verdict template (fill on device):** *Usable for personal chapter listen: yes/no. First-chapter time to audio: __ s. Subjective match to owner: /5.*

## Tests

- Unit: `clone-shipping.test.ts`, narration own-voice migration, `clone-engine.test.ts`.
- Narration e2e (preview flag): `npm run test:e2e:narration` — picker visibility only with `VITE_PN_VOICE_CLONE_PREVIEW=1`.
- Full neural path: manual on device with `VITE_PN_PHONE_VOICE_CLONE=1` until a gated CI job with cached HF artifacts exists.
