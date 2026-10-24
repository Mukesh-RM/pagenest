# Expressive narration spike (Phase 5 prep, MIT / no GPL)

**Branch:** `feature/narration-expressive`  
**Scope:** Rule-based emotion, pacing, dialogue/cast planning, and Piper prosody levers — no GPL models or lexicons.

## Quality context (vetted voices)

All **OK** English Piper voices in PageNest are **audiobook-style** (LibriVox, LJ Speech, LibriTTS) — not character or emotional acting voices. Expressiveness in Phase 5 comes from **our own prosody pipeline**, not from picking a “dramatic” checkpoint:

- **Pacing:** `length_scale` / `DeliveryPlan.rate` within modest bounds (avoid chipmunk or drag).
- **Pauses:** punctuation + paragraph gaps via `pause-planner` and PCM silence after synthesis.
- **Dialogue vs narration:** segment quotes; switch **distinct approved voice ids** for cast members where possible.
- **Emotion (rule-based):** small tweaks to `noise_scale`, `noise_w`, and volume — estimates only; validate by listening.

Forbidden for product use (vetting): `en_US-lessac*`, `en_US-libritts_r*` (lessac-derived), `en_US-amy*`, `en_US-ryan*`, and ~98 other Piper voices — see `docs/MODEL_VETTING.md`.

---

## Piper prosody levers (verified from voice config + MIT Piper docs)

Piper VITS ONNX models expose three runtime **scales** (see each voice `.onnx.json` `inference` block and [rhasspy/piper](https://github.com/rhasspy/piper) ONNX runner):

| Lever | Config field | Typical default (example `en_US-ljspeech-medium`) | Audible effect (estimate) |
|---|---|---:|---|
| Speaking rate | `length_scale` | `1.0` | **>1** slows speech; **<1** speeds up (multiplies mel/frame timing). |
| Generator noise | `noise_scale` | `~0.667` | Higher → more breathiness / variability; lower → flatter, more “studio” (estimate). |
| Phoneme noise | `noise_w` | `~0.8` | Affects duration stochasticity; lower can sound more clipped (estimate). |
| Speaker embedding | `sid` (multi-speaker only) | per `speaker_id_map` | Only for checkpoints with `num_speakers` **> 1** (see table below). |

**Not in Piper ONNX:** pitch shifting or SSML — pitch/volume for Speech API only; expressive spike maps “emotion” → scales + `DeliveryPlan.rate/volume` for engines that support them.

**PCM pauses:** Paragraph / punctuation gaps are **inserted silence** after synthesis (`appendSilencePcm`), not Piper parameters.

Sources: [Piper ONNX benchmark script](https://github.com/rhasspy/piper/blob/master/src/benchmark/benchmark_onnx.py) (scales vector), voice JSON on [Hugging Face Piper voices](https://huggingface.co/rhasspy/piper-voices) (HTTP 200).

---

## Approved voices: multi-speaker (`num_speakers` from `.onnx.json`)

Verified from [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) configs (2026-10-24). Cast mapping for English fiction should prefer **distinct voice ids** for the eight single-speaker voices; use `sid` only when staying on one multi-speaker checkpoint.

| Voice id | `num_speakers` | Cast mapping |
|---|---:|---|
| `en_US-ljspeech-high` | 1 | distinct voice ids |
| `en_US-ljspeech-medium` | 1 | distinct voice ids |
| `en_US-kristin-medium` | 1 | distinct voice ids |
| `en_US-john-medium` | 1 | distinct voice ids |
| `en_US-norman-medium` | 1 | distinct voice ids |
| `en_GB-cori-high` | 1 | distinct voice ids |
| `en_GB-cori-medium` | 1 | distinct voice ids |
| `en_US-libritts-high` | 904 | optional `sid` **or** other approved ids (CC BY 4.0 — attribution) |
| `de_DE-mls-medium` | 236 | optional `sid` (non-English cast) |
| `fr_FR-mls-medium` | 125 | optional `sid` |
| `nl_NL-mls-medium` | 52 | optional `sid` |

Code: `src/engines/tts/piper/approved-voices.ts`; `planExpressiveDelivery` sets `speakerId` only when `piperVoiceSupportsSpeakerId(voiceId)` is true.

---

## Implemented modules (pure, tested)

| Module | Path | Role |
|---|---|---|
| Emotion lexicon | `emotion-lexicon.ts` | MIT in-repo word + speech-verb lists |
| Emotion tagger | `emotion-tagger.ts` | Punctuation, caps, lexicon, dialogue verb |
| Pause planner | `pause-planner.ts` | Per-sentence `pauseAfterMs`, paragraph bonus, PCM silence |
| Dialogue segmenter | `dialogue-segmenter.ts` | Quotes, narration vs dialogue, speaker hint |
| Delivery planner | `delivery-planner.ts` | `ExpressiveDeliveryPlan` → `DeliveryPlan` + `PiperScalePlan` + cast voice / optional `sid` |

`ExpressiveDeliveryPlan` extends blueprint `DeliveryPlan` with `piper: { lengthScale, noiseScale, noiseW }`, optional `voiceId` / `speakerId`, and `segmentKind`.

### Cast / dialogue voices

- **Dialogue:** `dialogueVoiceId` when segment is quoted speech (another approved id).
- **Cast:** `castVoiceBySpeaker` maps `speakerHint` → Piper voice id (primary path for clean English voices).
- **`castSpeakerIdBySpeaker`:** ONNX `sid` only when the resolved `voiceId` is multi-speaker (`en_US-libritts-high`, MLS voices).

---

## Rule-based emotion tagger design

1. **Punctuation:** `?` → tense; `!` → happy/shout; `...` → sad/tense.
2. **MIT lexicon:** small closed vocabulary (`happy`, `afraid`, …) with weights.
3. **Speech verbs:** `whispered` / `shouted` from attribution or dialogue segmenter.
4. **Orthography:** ALL CAPS → shout/angry boost.

Output: `EmotionTag { emotion, confidence, reasons[] }` → `planExpressiveDelivery` adjusts length/noise scales and volume/rate (modest deltas).

---

## External lexicons — license findings

| Resource | Redistributable in PageNest? | Link (verified) |
|---|---|---|
| **NRC EmoLex** | **No** — no redistribution; commercial license for products | [Terms](https://saifmohammad.com/WebPages/NRC-Emotion-Lexicon.htm) (200) |
| **AFINN** | Ambiguous for bundling — not used | [GitHub](https://github.com/fnielsen/afinn) |
| **In-repo MIT lexicon** | **Yes** | `emotion-lexicon.ts` |

**Decision:** use only self-authored MIT word lists in-repo.

---

## Tests

- `src/features/narration/expressive/*.test.ts` — tagger, pauses, dialogue, delivery planner.
- `src/engines/tts/piper/approved-voices.test.ts` — vetted voice registry.

---

## Risks

| Risk | Note |
|---|---|
| Rule emotion accuracy | Listening tests required; no ML model in this spike |
| Audiobook timbre | Expressiveness is prosody, not voice acting |
| Pause durations | Estimates; tune per theme / user “Natural vs Expressive” |
| Dialogue attribution | Heuristic; fails on unconventional typography |
| Piper scale mapping | Estimates; validate per voice family |
| libritts-high attribution | CC BY 4.0 — show attribution in app licenses UI |

---

## Open items

- **Audio:** apply `appendSilencePcm` in render queue; Opus encode.
- **Reader:** highlight sync with segmented clauses.
- **Auditor:** registry rows in `scripts/audit-models.json` for each shipped voice.
