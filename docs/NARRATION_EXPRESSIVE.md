# Expressive narration spike (Phase 5 prep, MIT / no GPL)

**Branch:** `feature/narration-expressive`  
**Scope:** Rule-based emotion, pacing, dialogue/cast planning, and Piper prosody levers — no GPL models or lexicons.

## Piper prosody levers (verified from voice config + MIT Piper docs)

Piper VITS ONNX models expose three runtime **scales** (see each voice `.onnx.json` `inference` block and [rhasspy/piper](https://github.com/rhasspy/piper) ONNX runner):

| Lever | Config field | Typical default (example `en_US-libritts_r-medium`) | Audible effect (estimate) |
|---|---|---:|---|
| Speaking rate | `length_scale` | `1.0` | **>1** slows speech; **<1** speeds up (multiplies mel/frame timing). |
| Generator noise | `noise_scale` | `~0.333` | Higher → more breathiness / variability; lower → flatter, more “studio” (estimate). |
| Phoneme noise | `noise_w` | `~0.333` | Affects duration stochasticity; lower can sound more clipped (estimate). |
| Voice identity | `sid` (multi-speaker) | per `speaker_id_map` | Switches speaker embedding in multi-speaker checkpoints (e.g. LibriTTS multi). |

**Not in Piper ONNX:** pitch shifting or SSML — pitch/volume for Speech API only; expressive spike maps “emotion” → scales + `DeliveryPlan.rate/volume` for engines that support them.

**PCM pauses:** Paragraph / punctuation gaps are **inserted silence** after synthesis (`appendSilencePcm`), not Piper parameters.

Sources: [Piper ONNX benchmark script](https://github.com/rhasspy/piper/blob/master/src/benchmark/benchmark_onnx.py) (scales vector), voice JSON on [Hugging Face Piper voices](https://huggingface.co/rhasspy/piper-voices) (HTTP 200).

---

## Implemented modules (pure, tested)

| Module | Path | Role |
|---|---|---|
| Emotion lexicon | `emotion-lexicon.ts` | MIT in-repo word + speech-verb lists |
| Emotion tagger | `emotion-tagger.ts` | Punctuation, caps, lexicon, dialogue verb |
| Pause planner | `pause-planner.ts` | Per-sentence `pauseAfterMs`, paragraph bonus, PCM silence |
| Dialogue segmenter | `dialogue-segmenter.ts` | Quotes, narration vs dialogue, speaker hint |
| Delivery planner | `delivery-planner.ts` | `ExpressiveDeliveryPlan` → `DeliveryPlan` + `PiperScalePlan` + cast voice/`sid` |

`ExpressiveDeliveryPlan` extends blueprint `DeliveryPlan` with `piper: { lengthScale, noiseScale, noiseW }`, optional `voiceId` / `speakerId`, and `segmentKind`.

### Cast / dialogue voices

- **Dialogue:** `dialogueVoiceId` when segment is quoted speech.
- **Cast:** `castVoiceBySpeaker` maps `speakerHint` → Piper voice id; `castSpeakerIdBySpeaker` maps → ONNX `sid` for multi-speaker models.

---

## Rule-based emotion tagger design

1. **Punctuation:** `?` → tense; `!` → happy/shout; `...` → sad/tense.
2. **MIT lexicon:** small closed vocabulary (`happy`, `afraid`, …) with weights.
3. **Speech verbs:** `whispered` / `shouted` from attribution or dialogue segmenter.
4. **Orthography:** ALL CAPS → shout/angry boost.

Output: `EmotionTag { emotion, confidence, reasons[] }` → `planExpressiveDelivery` adjusts length/noise scales and volume/rate.

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

---

## Risks

| Risk | Note |
|---|---|
| Rule emotion accuracy | Listening tests required; no ML model in this spike |
| Pause durations | Estimates; tune per theme / user “Natural vs Expressive” |
| Dialogue attribution | Heuristic; fails on unconventional typography |
| Piper scale mapping | Estimates; should be validated per voice family |

---

## Open items

- **Audio:** apply `appendSilencePcm` in render queue; Opus encode.
- **Reader:** highlight sync with segmented clauses.
- **Auditor:** confirm no bundled third-party lexicons.
