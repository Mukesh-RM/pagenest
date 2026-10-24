# Model and voice vetting

Owner: Auditor. Rule (blueprint sections 4, 9.3, 17; Decisions 8 and 9): every model must allow free distribution **including the weights**, and the app must stay MIT-compatible. This file is the checklist, the evidence and the result. The machine-readable registry is `scripts/audit-models.json`; `node scripts/audit-models.mjs` fails when code in `src/` or `public/` names a voice, model file or Hugging Face repo that is not `OK` there. The tables below are generated (`node scripts/audit-models.mjs --write`); everything else is hand written.

Legend: **OK** = reviewed and redistributable (attribution recorded). **NOT OK** = blocked. **VERIFY** = not proven; treated as blocked until someone finishes the checklist.

## 1. Headline findings (read this first)

1. **Almost no Piper voice is clean.** Piper voices are mostly fine-tuned from other Piper voices, and the base voices are `en_US-lessac` (Blizzard 2013 data, research-only licence) and `en_US-ryan` (RyanSpeech, CC BY-NC-SA 4.0). The MODEL_CARD says "Finetuned from U.S. English lessac voice" or "...Ryan voice" for most of them, in every language. We treat a voice that descends from either base as **NOT OK**: the Lessac licence excludes "any commercial purpose, including the development ... of voice synthesis ... products or services" and is "non-exclusive and non-transferable ... without the right to sub-licence", so weights derived from that data cannot be handed to users. Whether fine-tuned weights are legally "derived" is unsettled, which is exactly why this is the cautious reading; the owner can overrule it with legal advice, but then the registry row must say so.
2. **Decision 8 needs one correction.** It says "prefer libritts_r voices". `en_US-libritts_r-medium` is "Fine-tuned from English lessac medium" (MODEL_CARD), so it inherits the Lessac problem even though LibriTTS-R itself is CC BY 4.0. The clean multi-speaker voice is **`en_US-libritts-high`** (trained from scratch on LibriTTS train-clean-360, CC BY 4.0).
3. **Clean English voices today (8):** `en_US-libritts-high`, `en_US-kristin-medium`, `en_US-john-medium`, `en_US-norman-medium`, `en_US-ljspeech-high`, `en_US-ljspeech-medium`, `en_GB-cori-high`, `en_GB-cori-medium`. Three more (`de_DE`, `fr_FR`, `nl_NL` `mls-medium`) are clean in other languages. All other languages are mostly `NOT OK` or `VERIFY`; this matters for the blueprint promise about Indian languages (every `hi_IN`, `ml_IN`, `te_IN`, `mr_IN`, `ne_NP` voice is either lessac-derived, NC-SA or has no recorded dataset licence).
4. **Quality caveat for planning:** the OK voices are LibriVox (public domain) or LibriTTS voices, i.e. audiobook-style speech; none is an emotional or character voice.
5. **GPL engine path (Decision 8)** is unchanged and verified: eSpeak NG, `piper-phonemize` builds, `piper1-gpl` and the `phonemizer` npm package (used by `kokoro-js`) are GPL-3.0-or-later in the form we would ship. See the components table.
6. **Kokoro-82M weights are Apache-2.0** (verified on the Hugging Face tags), but `kokoro-js` cannot be used as is because it depends on `phonemizer`.

<!-- BEGIN GENERATED: summary -->
Registry reviewed 2026-10-24 against `https://huggingface.co/rhasspy/piper-voices` at revision `5041a7a4`.

| | Voices | OK | NOT OK | VERIFY |
|---|---:|---:|---:|---:|
| All languages | 178 | 11 | 131 | 36 |
| English (en_US, en_GB) | 38 | 8 | 29 | 1 |

Why voices are blocked (a voice can have several reasons):

- `lessac-lineage`: 78
- `dataset-license-not-recorded`: 27
- `nc-lineage`: 20
- `dataset-nc`: 20
- `dataset-share-alike`: 11
- `dataset-license-unknown`: 11
- `lessac-dataset`: 3
- `dataset-copyleft`: 3
- `all-rights-reserved`: 2
- `lineage-unknown`: 1
<!-- END GENERATED: summary -->

## 2. Per-voice checklist (do this before a voice is added to the app)

Do all eight steps. Write the result into `scripts/audit-models.json` (a `voices` row) and run `node scripts/audit-models.mjs --write`. A voice with `verdict: "OK"` must have `reviewed: "manual"`, an `attribution`, the `.onnx` sha256, and at least one evidence link, or the audit reports a registry problem.

1. **Find the MODEL_CARD.** `https://huggingface.co/rhasspy/piper-voices/blob/main/<lang>/<locale>/<voice>/<quality>/MODEL_CARD` (raw: replace `blob` with `resolve`). Note the repository revision you looked at. Third-party voices (other Hugging Face repos, GitHub releases) have no card guarantee: find the author's page and treat missing information as VERIFY.
2. **Identify the training dataset and its URL.** The card's `Dataset URL`. "See URL" or an empty field is not an answer: open the URL and find the licence file.
3. **Read the dataset licence itself, from the primary source** (the corpus site or a licence file in its repository), not from the card or a summary. Record the exact name and a short quote. Check: commercial use allowed? redistribution of derived models allowed? attribution wording? share-alike (SA)? no-derivatives (ND)? non-commercial (NC)? Research-only corpora (for example Blizzard 2013 for lessac) are NOT OK. NC, ND, AGPL, GPL, RAIL, "unknown" and "all rights reserved" are NOT OK. SA is VERIFY (the weights might have to be shared under the same licence: owner decision).
4. **Check the lineage.** Read "Training" on the card: "Trained from scratch", or "Finetuned from X". Follow X to its card and repeat steps 2 to 3 for it, recursively. A voice is only as clean as its dirtiest ancestor. Unknown lineage ("unreleased voice", missing) is VERIFY.
5. **Confirm the voice's own licence field.** The `.onnx.json` has a `dataset` name only; the repository (`rhasspy/piper-voices`) carries the Hugging Face tag `license: mit`, which covers the repository files, not the training data. Record both, and do not treat the repo tag as a substitute for steps 3 and 4.
6. **Record integrity data:** download URL, file size, and the sha256 of the `.onnx` (the Hugging Face LFS pointer shows it: `curl -sL https://huggingface.co/api/models/rhasspy/piper-voices/tree/main/<path>` and read `lfs.oid`, then verify the downloaded file with `sha256sum`). The app's model manifest uses the same sha256 (see `docs/NARRATION_SPIKE.md`).
7. **Write the attribution text** the app must show (author, dataset, licence, link). CC BY needs author, licence, link and a note of changes; public domain needs none (a courtesy credit is recommended); CMU data needs the copyright notice and conditions (section 5).
8. **Decide OK / NOT OK / VERIFY** and write the reason in one sentence plus the evidence links. When in doubt, VERIFY. Never mark OK from the card text alone.

How to refresh the registry: the data (file sizes, sha256, cards) is read from the Hugging Face tree API (`/api/models/rhasspy/piper-voices/tree/main/<lang>`); rows with `reviewed: "auto"` were classified by rules (licence keywords, lineage text) and are never OK.

## 3. Piper voices that matter for PageNest: English (all 38 en_US and en_GB voices)

Hugging Face repository `rhasspy/piper-voices`, MODEL_CARDs read on 2026-10-24. "src1/src2" are the primary sources used for the verdict beyond the card.

<!-- BEGIN GENERATED: english -->
| Voice | Dataset | Dataset license (card) | Lineage | Verdict | Why | sha256 of .onnx | Evidence |
|---|---|---|---|---|---|---|---|
| en_GB-alan-low | https://github.com/MycroftAI/mimic3-voices/blob/master/voic… | See URL | finetuned from en_US-ryan-low | **NOT OK** | Dataset LICENSE file (MycroftAI/mimic3-voices apope_low) reads only 'Copyright 2022 Mycroft AI, All Rights Reserved': no redistribution grant. Also fine-tuned from the N… | `a1f60584620a`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/alan/low/MODEL_CARD) [src1](https://github.com/MycroftAI/mimic3-voices/blob/master/voices/en_UK/apope_low/LICENSE) |
| en_GB-alan-medium | https://github.com/MycroftAI/mimic3-voices/blob/master/voic… | See URL | finetuned from en_US-lessac-medium | **NOT OK** | Dataset LICENSE file (MycroftAI/mimic3-voices apope_low) reads only 'Copyright 2022 Mycroft AI, All Rights Reserved': no redistribution grant. Also fine-tuned from the l… | `0a3096689322`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/alan/medium/MODEL_CARD) [src1](https://github.com/MycroftAI/mimic3-voices/blob/master/voices/en_UK/apope_low/LICENSE) |
| en_GB-alba-medium | https://datashare.ed.ac.uk/handle/10283/3270 | https://creativecommons.org/licenses/by/4.0/ | finetuned from en_US-lessac-medium | **NOT OK** | descends from en_US-lessac-medium (lessac, Blizzard 2013 research-only data) via 'Finetuned from ...'. | `401369c4a81d`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/alba/medium/MODEL_CARD) [src1](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) |
| en_GB-aru-medium | https://www.liverpool.ac.uk/architecture/research/acoustics… | https://creativecommons.org/licenses/by/4.0/ | finetuned from en_US-lessac-medium | **NOT OK** | descends from en_US-lessac-medium (lessac, Blizzard 2013 research-only data) via 'Finetuned from ...'. | `9e74d089a856`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/aru/medium/MODEL_CARD) [src1](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) |
| en_GB-cori-high | https://librivox.org | public domain | scratch | **OK** | Trained from scratch on LibriVox recordings (public domain, per card). | `470b4dd634c9`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/cori/high/MODEL_CARD) [src1](https://librivox.org/pages/public-domain/) |
| en_GB-cori-medium | https://librivox.org | public domain | scratch | **OK** | Trained from scratch on LibriVox recordings (public domain, per card). | `1899f98e5fb8`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/cori/medium/MODEL_CARD) [src1](https://librivox.org/pages/public-domain/) |
| en_GB-jenny_dioco-medium | https://github.com/dioco-group/jenny-tts-dataset | See URL | finetuned from en_US-lessac-medium | **NOT OK** | card only says "See URL" / see licence file, dataset licence not recorded; descends from en_US-lessac-medium (lessac, Blizzard 2013 research-only data) via 'Finetuned fr… | `469c630d209e`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/jenny_dioco/medium/MODEL_CARD) [src1](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) |
| en_GB-northern_english_male-medium | http://www.openslr.org/83/ | CC-BY-SA 4.0 International | finetuned from en_US-lessac-medium | **NOT OK** | dataset licence is share-alike, so the weights may have to be released under the same licence (owner decision needed); descends from en_US-lessac-medium (lessac, Blizzar… | `57a219ae8e63`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/northern_english_male/medium/MODEL_CARD) [src1](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) |
| en_GB-semaine-medium | https://github.com/marytts/dfki-semaine-data | http://creativecommons.org/licenses/by-nc-sa/4.0/ | finetuned from en_US-lessac-medium | **NOT OK** | dataset licence is non-commercial. | `d6dab6f3b92d`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/semaine/medium/MODEL_CARD) |
| en_GB-southern_english_female-low | http://www.openslr.org/83/ | CC-BY-SA 4.0 International | finetuned from en_US-ryan-low | **NOT OK** | dataset licence is share-alike, so the weights may have to be released under the same licence (owner decision needed); descends from en_US-ryan-low whose dataset is non-… | `f2f37aed1b3a`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/southern_english_female/low/MODEL_CARD) |
| en_GB-vctk-medium | https://datashare.ed.ac.uk/handle/10283/3443 | https://creativecommons.org/licenses/by/4.0/ | finetuned from en_US-lessac-medium | **NOT OK** | descends from en_US-lessac-medium (lessac, Blizzard 2013 research-only data) via 'Finetuned from ...'. | `4e9fc85ab900`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/vctk/medium/MODEL_CARD) [src1](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) |
| en_US-amy-low | https://github.com/MycroftAI/mimic3-voices | See URL | finetuned from en_US-ryan-low | **NOT OK** | card only says "See URL" / see licence file, dataset licence not recorded; descends from en_US-ryan-low whose dataset is non-commercial. | `a5a91abb7de0`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/amy/low/MODEL_CARD) |
| en_US-amy-medium | https://github.com/MycroftAI/mimic3-voices | See URL | finetuned from en_US-lessac-medium | **NOT OK** | card only says "See URL" / see licence file, dataset licence not recorded; descends from en_US-lessac-medium (lessac, Blizzard 2013 research-only data) via 'Finetuned fr… | `b3a6e47b57b8`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/amy/medium/MODEL_CARD) [src1](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) |
| en_US-arctic-medium | http://www.festvox.org/cmu_arctic/ | See LICENSE file | finetuned from en_US-lessac-medium | **NOT OK** | card only says "See URL" / see licence file, dataset licence not recorded; descends from en_US-lessac-medium (lessac, Blizzard 2013 research-only data) via 'Finetuned fr… | `483303e29494`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/arctic/medium/MODEL_CARD) [src1](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) |
| en_US-bryce-medium | n/a | public domain | finetuned from an unreleased voice (card) | **VERIFY** | Dataset is the author's own voice (public domain per card), but the card says it was fine-tuned from 'an unreleased voice' so the lineage cannot be checked. Ask the auth… | `dc9caa6c3131`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/bryce/medium/MODEL_CARD) |
| en_US-danny-low | https://github.com/MycroftAI/mimic3-voices | See URL | finetuned from en_US-ryan-low | **NOT OK** | card only says "See URL" / see licence file, dataset licence not recorded; descends from en_US-ryan-low whose dataset is non-commercial. | `56a9ae9499e9`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/danny/low/MODEL_CARD) |
| en_US-hfc_female-medium | https://ast-astrec.nict.go.jp/en/release/hi-fi-captain/ | https://creativecommons.org/licenses/by-nc-sa/4.0… | finetuned from en_US-lessac-medium | **NOT OK** | dataset licence is non-commercial. | `914c473788fc`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/hfc_female/medium/MODEL_CARD) |
| en_US-hfc_male-medium | https://ast-astrec.nict.go.jp/en/release/hi-fi-captain/ | https://creativecommons.org/licenses/by-nc-sa/4.0… | finetuned from en_US-lessac-medium | **NOT OK** | dataset licence is non-commercial. | `d11e403a02bd`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/hfc_male/medium/MODEL_CARD) |
| en_US-joe-medium | https://github.com/OHF-Voice/voice-datasets | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | descends from en_US-lessac-medium (lessac, Blizzard 2013 research-only data) via 'Finetuned from ...'. | `58afce0321b8`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/joe/medium/MODEL_CARD) [src1](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) |
| en_US-john-medium | https://librivox.org | public domain | finetuned from en_US-kristin-medium | **OK** | Fine-tuned from Kristin (scratch, LibriVox public domain); no lessac or ryan ancestry. | `789c6c875726`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/john/medium/MODEL_CARD) [src1](https://librivox.org/pages/public-domain/) |
| en_US-kathleen-low | https://github.com/rhasspy/dataset-voice-kathleen | CC0 | finetuned from en_US-ryan-low | **NOT OK** | descends from en_US-ryan-low whose dataset is non-commercial. | `87adf17f5326`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/kathleen/low/MODEL_CARD) |
| en_US-kristin-medium | https://librivox.org | public domain | scratch | **OK** | Trained from scratch on LibriVox recordings the author describes as public domain (card). | `5849957f929c`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/kristin/medium/MODEL_CARD) [src1](https://librivox.org/pages/public-domain/) |
| en_US-kusal-medium | https://github.com/MycroftAI/mimic2 | See URL | finetuned from en_US-lessac-medium | **NOT OK** | card only says "See URL" / see licence file, dataset licence not recorded; descends from en_US-lessac-medium (lessac, Blizzard 2013 research-only data) via 'Finetuned fr… | `438ae25bb305`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/kusal/medium/MODEL_CARD) [src1](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) |
| en_US-l2arctic-medium | https://www.isca-speech.org/archive/interspeech_2018/zhao18… | https://creativecommons.org/licenses/by-nc/4.0/ | finetuned from en_US-lessac-medium | **NOT OK** | dataset licence is non-commercial. | `d89f6f124bf1`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/l2arctic/medium/MODEL_CARD) |
| en_US-lessac-high | https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_bli… | https://www.cstr.ed.ac.uk/projects/blizzard/2013/… | scratch | **NOT OK** | Dataset is Lessac Technologies' Blizzard 2013 data under a research-only licence. Research Purposes "excludes ... any commercial purpose, including the development, mark… | `4cabf7c3a638`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/lessac/high/MODEL_CARD) [src1](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) |
| en_US-lessac-low | https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_bli… | https://www.cstr.ed.ac.uk/projects/blizzard/2013/… | scratch | **NOT OK** | Dataset is Lessac Technologies' Blizzard 2013 data under a research-only licence. Research Purposes "excludes ... any commercial purpose, including the development, mark… | `f7d01dde3715`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/lessac/low/MODEL_CARD) [src1](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) |
| en_US-lessac-medium | https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_bli… | https://www.cstr.ed.ac.uk/projects/blizzard/2013/… | scratch | **NOT OK** | Dataset is Lessac Technologies' Blizzard 2013 data under a research-only licence. Research Purposes "excludes ... any commercial purpose, including the development, mark… | `5efe09e69902`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/lessac/medium/MODEL_CARD) [src1](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) |
| en_US-libritts-high | http://www.openslr.org/60/ | CC BY 4.0 | scratch | **OK** | CC BY 4.0 verified at https://www.openslr.org/60/ (License: CC BY 4.0); card: trained from scratch on train-clean-360. | `9127a559e116`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/libritts/high/MODEL_CARD) [src1](https://www.openslr.org/60/) |
| en_US-libritts_r-medium | http://www.openslr.org/141/ | CC BY 4.0 | finetuned from en_US-lessac-medium | **NOT OK** | Dataset LibriTTS-R is CC BY 4.0 (verified, https://www.openslr.org/141/), BUT the card says the voice is 'Fine-tuned from English lessac medium'. The weights descend fro… | `10bb85e071d6`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/libritts_r/medium/MODEL_CARD) [src1](https://www.openslr.org/141/) [src2](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) |
| en_US-ljspeech-high | https://keithito.com/LJ-Speech-Dataset/ | public domain | scratch | **OK** | LJ Speech is public domain (verified at keithito.com: 'License Public Domain'); trained from scratch. | `5d4f08ba6a2a`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ljspeech/high/MODEL_CARD) [src1](https://keithito.com/LJ-Speech-Dataset/) |
| en_US-ljspeech-medium | https://keithito.com/LJ-Speech-Dataset/ | public domain | scratch | **OK** | LJ Speech is public domain (verified at keithito.com: 'License Public Domain'); trained from scratch. | `6f52a751e234`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ljspeech/medium/MODEL_CARD) [src1](https://keithito.com/LJ-Speech-Dataset/) |
| en_US-mike-medium | https://github.com/OHF-Voice/voice-datasets | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | descends from en_US-lessac-medium (lessac, Blizzard 2013 research-only data) via 'Finetuned from ...'. | `3157e69e2c58`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/mike/medium/MODEL_CARD) [src1](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) |
| en_US-norman-medium | https://librivox.org | public domain | scratch | **OK** | Trained from scratch on LibriVox recordings (public domain, per card). | `b9739443232a`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/norman/medium/MODEL_CARD) [src1](https://librivox.org/pages/public-domain/) |
| en_US-reza_ibrahim-medium | https://huggingface.co/datasets/mah92/Hedayatfar-Persian-Qu… | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | descends from en_US-lessac-medium (lessac, Blizzard 2013 research-only data) via 'Finetuned from ...'. | `99f0c31464a2`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/reza_ibrahim/medium/MODEL_CARD) [src1](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) |
| en_US-ryan-high | https://www.kaggle.com/datasets/roholazandie/ryanspeech | CC BY-NC-SA 4.0 | scratch | **NOT OK** | Dataset RyanSpeech is CC BY-NC-SA 4.0 per the card (non-commercial, share-alike). Primary dataset page could not be fetched. | `b3990d7606e1`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ryan/high/MODEL_CARD) |
| en_US-ryan-low | https://www.kaggle.com/datasets/roholazandie/ryanspeech | CC BY-NC-SA 4.0 | scratch | **NOT OK** | Dataset RyanSpeech is CC BY-NC-SA 4.0 per the card (non-commercial, share-alike). Primary dataset page could not be fetched. | `8d21a085cc4c`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ryan/low/MODEL_CARD) |
| en_US-ryan-medium | https://www.kaggle.com/datasets/roholazandie/ryanspeech | CC BY-NC-SA 4.0 | finetuned from en_US-lessac-medium | **NOT OK** | Dataset RyanSpeech is CC BY-NC-SA 4.0 per the card; also fine-tuned from lessac. | `abf4c2748625`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ryan/medium/MODEL_CARD) |
| en_US-sam-medium | https://github.com/Sam-Accenture-Non-Binary-Voice/non-binar… | https://www.apache.org/licenses/LICENSE-2.0.txt | finetuned from en_US-lessac-medium | **NOT OK** | descends from en_US-lessac-medium (lessac, Blizzard 2013 research-only data) via 'Finetuned from ...'. | `56417b3b4afe`... | [card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/sam/medium/MODEL_CARD) [src1](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) |
<!-- END GENERATED: english -->

Primary-source checks behind the English verdicts (2026-10-24):

| Dataset | Licence found at the primary source | Evidence |
|---|---|---|
| Lessac Technologies, Blizzard 2013 (`lessac`) | Research Licence Agreement. "Research Purposes ... excludes ... any commercial purpose, including the development, marketing, commercialisation, sale or licencing of voice synthesis or speech recognition products or services"; licence is non-exclusive, non-transferable, no sub-licence. | https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html |
| LibriTTS (`libritts`) | "License: CC BY 4.0" | https://www.openslr.org/60/ |
| LibriTTS-R (`libritts_r`) | "License: CC BY 4.0" (dataset); the voice itself is lessac-derived | https://www.openslr.org/141/ |
| LJ Speech (`ljspeech`) | "License Public Domain" | https://keithito.com/LJ-Speech-Dataset/ |
| VCTK 0.92 (`vctk`, en_GB) | licence text: "Creative Commons License: Attribution 4.0 International". Voice is lessac-derived, so NOT OK anyway | https://datashare.ed.ac.uk/bitstream/handle/10283/3443/license_text.txt |
| Alba (Edinburgh, `alba`) | licence text: CC BY 4.0, plus "Any use derogatory to the voice talent is prohibited". Voice is lessac-derived, so NOT OK | https://datashare.ed.ac.uk/bitstream/handle/10283/3270/license_text.txt |
| Mycroft apope (`alan`) | LICENSE file: only "Copyright 2022 Mycroft AI, All Rights Reserved" | https://github.com/MycroftAI/mimic3-voices/blob/master/voices/en_UK/apope_low/LICENSE |
| CMU ARCTIC (`arctic`) | Permissive CMU licence (retain notices, mark modifications). Voice is lessac-derived, so NOT OK | https://github.com/MycroftAI/mimic3-voices/blob/master/voices/en_US/cmu-arctic_low/LICENSE |
| Jenny (Dioco, `jenny_dioco`) | README: "Attribution is required ... the voice must be referred to as 'Jenny' ... Commercial use is permitted ... No further restrictions apply." Voice is lessac-derived, so NOT OK | https://github.com/dioco-group/jenny-tts-dataset |
| OHF-Voice/voice-datasets (`joe`, `mike`, `kathleen`, `ukrainian_tts`) | "These datasets are licensed under CC0 (public domain)". Voices are lessac or ryan-derived, so NOT OK (except `uk_UA-ukrainian_tts`, VERIFY) | https://github.com/OHF-Voice/voice-datasets |
| Multilingual LibriSpeech (`mls`) | "License: CC BY 4.0" | https://www.openslr.org/94/ |
| OpenSLR 83 (`northern_english_male`, `southern_english_female`) | "Attribution-ShareAlike 4.0 International" | https://www.openslr.org/83/ |
| RyanSpeech, Hi-Fi Captain (NICT), SEMAINE, L2-ARCTIC | **UNVERIFIED at the primary source** (site down, JavaScript-only or login wall). The MODEL_CARDs say CC BY-NC-SA 4.0 (Ryan, Hi-Fi Captain, SEMAINE) and CC BY-NC 4.0 (L2-ARCTIC); the verdict is NOT OK on that evidence | cards linked in the table |
| LibriVox recordings (`kristin`, `john`, `norman`, `cori`) | Author states the recordings are public domain; LibriVox's policy page confirms that LibriVox recordings are in the public domain. The underlying books must be public domain too: the author says so, which was **not independently verified book by book** | https://librivox.org/pages/public-domain/ |

## 4. Other languages (one row per voice)

Rows with `unreviewed` have only been classified from the MODEL_CARD text. If a language matters for a release, finish the checklist for one voice in that language and promote it.

<!-- BEGIN GENERATED: other -->
| Voice | Dataset license (card) | Lineage | Verdict | Blockers |
|---|---|---|---|---|
| [ar_JO-kareem-low](https://huggingface.co/rhasspy/piper-voices/blob/main/ar/ar_JO/kareem/low/MODEL_CARD) | See URL | finetuned from en_US-lessac-medium | **NOT OK** | dataset-license-not-recorded, lessac-lineage |
| [ar_JO-kareem-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/ar/ar_JO/kareem/medium/MODEL_CARD) | See URL | finetuned from en_US-lessac-medium | **NOT OK** | dataset-license-not-recorded, lessac-lineage |
| [bg_BG-dimitar-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/bg/bg_BG/dimitar/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [bn_BD-google-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/bn/bn_BD/google/medium/MODEL_CARD) | Attribution-ShareAlike 4.0 International | finetuned from en_US-libritts_r-medium | **NOT OK** | dataset-share-alike, lessac-lineage |
| [ca_ES-upc_ona-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/ca/ca_ES/upc_ona/medium/MODEL_CARD) | CC BY-SA 3.0 ES | finetuned from en_US-lessac-medium | **NOT OK** | dataset-share-alike, lessac-lineage |
| [ca_ES-upc_ona-x_low](https://huggingface.co/rhasspy/piper-voices/blob/main/ca/ca_ES/upc_ona/x_low/MODEL_CARD) | CC BY-SA 3.0 ES | scratch | **VERIFY** | dataset-share-alike |
| [ca_ES-upc_pau-x_low](https://huggingface.co/rhasspy/piper-voices/blob/main/ca/ca_ES/upc_pau/x_low/MODEL_CARD) | CC BY-SA 3.0 ES | scratch | **VERIFY** | dataset-share-alike |
| [cs_CZ-jirka-low](https://huggingface.co/rhasspy/piper-voices/blob/main/cs/cs_CZ/jirka/low/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [cs_CZ-jirka-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/cs/cs_CZ/jirka/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [cs_CZ-kasandra-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/cs/cs_CZ/kasandra/medium/MODEL_CARD) | Creative Commons Attribution 4.0 Intern… | unknown | **VERIFY** | unreviewed |
| [cy_GB-bu_tts-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/cy/cy_GB/bu_tts/medium/MODEL_CARD) | CC-BY | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [cy_GB-gwryw_gogleddol-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/cy/cy_GB/gwryw_gogleddol/medium/MODEL_CARD) | See URL | finetuned from en_US-lessac-medium | **NOT OK** | dataset-license-not-recorded, lessac-lineage |
| [da_DK-talesyntese-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/da/da_DK/talesyntese/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [de_DE-eva_k-x_low](https://huggingface.co/rhasspy/piper-voices/blob/main/de/de_DE/eva_k/x_low/MODEL_CARD) | See URL | scratch | **VERIFY** | dataset-license-not-recorded |
| [de_DE-karlsson-low](https://huggingface.co/rhasspy/piper-voices/blob/main/de/de_DE/karlsson/low/MODEL_CARD) | See URL | finetuned from en_US-ryan-low | **NOT OK** | dataset-license-not-recorded, nc-lineage |
| [de_DE-kerstin-low](https://huggingface.co/rhasspy/piper-voices/blob/main/de/de_DE/kerstin/low/MODEL_CARD) | CC0 | finetuned from en_US-ryan-low | **NOT OK** | nc-lineage |
| [de_DE-mls-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/de/de_DE/mls/medium/MODEL_CARD) | CC-BY 4.0 | scratch | **OK** | none |
| [de_DE-pavoque-low](https://huggingface.co/rhasspy/piper-voices/blob/main/de/de_DE/pavoque/low/MODEL_CARD) | http://creativecommons.org/licenses/by-… | finetuned from en_US-ryan-low | **NOT OK** | dataset-nc |
| [de_DE-ramona-low](https://huggingface.co/rhasspy/piper-voices/blob/main/de/de_DE/ramona/low/MODEL_CARD) | See URL | scratch | **VERIFY** | dataset-license-not-recorded |
| [de_DE-thorsten-high](https://huggingface.co/rhasspy/piper-voices/blob/main/de/de_DE/thorsten/high/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [de_DE-thorsten-low](https://huggingface.co/rhasspy/piper-voices/blob/main/de/de_DE/thorsten/low/MODEL_CARD) | CC0 | finetuned from en_US-ryan-low | **NOT OK** | nc-lineage |
| [de_DE-thorsten-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/de/de_DE/thorsten/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [de_DE-thorsten_emotional-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/de/de_DE/thorsten_emotional/medium/MODEL_CARD) | CC0 | finetuned from de_DE-thorsten-medium | **NOT OK** | lessac-lineage |
| [el_GR-joy-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/el/el_GR/joy/medium/MODEL_CARD) | CC BY-NC 4.0 | unknown | **NOT OK** | dataset-nc |
| [el_GR-rapunzelina-low](https://huggingface.co/rhasspy/piper-voices/blob/main/el/el_GR/rapunzelina/low/MODEL_CARD) | CC0 | finetuned from en_US-ryan-low | **NOT OK** | nc-lineage |
| [el_GR-rapunzelina-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/el/el_GR/rapunzelina/medium/MODEL_CARD) | CC0 | scratch | **VERIFY** | unreviewed |
| [es_AR-daniela-high](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_AR/daniela/high/MODEL_CARD) | Attribution-ShareAlike 4.0 International | finetuned from en_US-lessac-medium | **NOT OK** | dataset-share-alike, lessac-lineage |
| [es_ES-carlfm-x_low](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_ES/carlfm/x_low/MODEL_CARD) | Public domain | scratch | **VERIFY** | unreviewed |
| [es_ES-davefx-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_ES/davefx/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [es_ES-mls_10246-low](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_ES/mls_10246/low/MODEL_CARD) | CC BY 4.0 | finetuned from en_US-ryan-low | **NOT OK** | nc-lineage |
| [es_ES-mls_9972-low](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_ES/mls_9972/low/MODEL_CARD) | CC BY 4.0 | finetuned from en_US-ryan-low | **NOT OK** | nc-lineage |
| [es_ES-sharvard-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_ES/sharvard/medium/MODEL_CARD) | http://creativecommons.org/licenses/by/… | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [es_MX-ald-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_MX/ald/medium/MODEL_CARD) | http://unlicense.org | finetuned from es_ES-davefx-medium | **NOT OK** | lessac-lineage |
| [es_MX-ald-x_low](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_MX/ald/x_low/MODEL_CARD) | not stated | scratch | **NOT OK** | dataset-license-unknown |
| [es_MX-claude-high](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_MX/claude/high/MODEL_CARD) | apache-2.0 | unknown | **VERIFY** | unreviewed |
| [et_EE-news-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/et/et_EE/news/medium/MODEL_CARD) | CC-BY (META-SHARE "Available - Unrestri… | finetuned from en_US-libritts_r-medium | **NOT OK** | lessac-lineage |
| [eu_ES-antton-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/eu/eu_ES/antton/medium/MODEL_CARD) | Creative Commons Attribution 4.0 | finetuned from en_US-amy-medium | **NOT OK** | lessac-lineage |
| [eu_ES-maider-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/eu/eu_ES/maider/medium/MODEL_CARD) | Creative Commons Attribution 4.0 | finetuned from en_US-amy-medium | **NOT OK** | lessac-lineage |
| [fa_IR-amir-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/fa/fa_IR/amir/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [fa_IR-ganji-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/fa/fa_IR/ganji/medium/MODEL_CARD) | CC0 | finetuned from fa_IR-amir-medium | **NOT OK** | lessac-lineage |
| [fa_IR-ganji_adabi-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/fa/fa_IR/ganji_adabi/medium/MODEL_CARD) | CC0 | finetuned from fa_IR-ganji-medium | **NOT OK** | lessac-lineage |
| [fa_IR-gyro-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/fa/fa_IR/gyro/medium/MODEL_CARD) | See URL | unknown | **VERIFY** | dataset-license-not-recorded |
| [fa_IR-reza_ibrahim-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/fa/fa_IR/reza_ibrahim/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [fi_FI-harri-low](https://huggingface.co/rhasspy/piper-voices/blob/main/fi/fi_FI/harri/low/MODEL_CARD) | CC0 | finetuned from en_US-ryan-low | **NOT OK** | nc-lineage |
| [fi_FI-harri-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/fi/fi_FI/harri/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [fr_FR-gilles-low](https://huggingface.co/rhasspy/piper-voices/blob/main/fr/fr_FR/gilles/low/MODEL_CARD) | CC0 | finetuned from en_US-ryan-low | **NOT OK** | nc-lineage |
| [fr_FR-mls-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/fr/fr_FR/mls/medium/MODEL_CARD) | CC-BY 4.0 | scratch | **OK** | none |
| [fr_FR-mls_1840-low](https://huggingface.co/rhasspy/piper-voices/blob/main/fr/fr_FR/mls_1840/low/MODEL_CARD) | CC BY 4.0 | finetuned from en_US-ryan-low | **NOT OK** | nc-lineage |
| [fr_FR-siwis-low](https://huggingface.co/rhasspy/piper-voices/blob/main/fr/fr_FR/siwis/low/MODEL_CARD) | CC-BY 4.0 | finetuned from en_US-ryan-low | **NOT OK** | nc-lineage |
| [fr_FR-siwis-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/fr/fr_FR/siwis/medium/MODEL_CARD) | CC-BY 4.0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [fr_FR-tom-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/fr/fr_FR/tom/medium/MODEL_CARD) | AGPLv3 | unknown | **NOT OK** | dataset-copyleft |
| [fr_FR-upmc-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/fr/fr_FR/upmc/medium/MODEL_CARD) | http://creativecommons.org/licenses/by-… | finetuned from en_US-lessac-medium | **NOT OK** | dataset-share-alike, lessac-lineage |
| [he_IL-saspeech-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/he/he_IL/saspeech/medium/MODEL_CARD) | See dataset URL | finetuned from en_US-libritts_r-medium | **NOT OK** | dataset-license-not-recorded, lessac-lineage |
| [hi_IN-pratham-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/hi/hi_IN/pratham/medium/MODEL_CARD) | http://creativecommons.org/licenses/by-… | unknown | **NOT OK** | dataset-nc |
| [hi_IN-priyamvada-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/hi/hi_IN/priyamvada/medium/MODEL_CARD) | http://creativecommons.org/licenses/by-… | unknown | **NOT OK** | dataset-nc |
| [hi_IN-rohan-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/hi/hi_IN/rohan/medium/MODEL_CARD) | https://www.iitm.ac.in/donlab/indictts/… | finetuned from en_US-lessac-medium | **NOT OK** | dataset-license-not-recorded, lessac-lineage |
| [hu_HU-anna-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/hu/hu_HU/anna/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [hu_HU-berta-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/hu/hu_HU/berta/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [hu_HU-imre-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/hu/hu_HU/imre/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [hy_AM-gor-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/hy/hy_AM/gor/medium/MODEL_CARD) | GPL 2.0 | finetuned from en_US-bryce-medium | **NOT OK** | dataset-copyleft |
| [id_ID-news_tts-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/id/id_ID/news_tts/medium/MODEL_CARD) | See URL | finetuned from en_US-lessac-medium | **NOT OK** | dataset-license-not-recorded, lessac-lineage |
| [is_IS-bui-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/is/is_IS/bui/medium/MODEL_CARD) | See URL | scratch | **VERIFY** | dataset-license-not-recorded |
| [is_IS-salka-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/is/is_IS/salka/medium/MODEL_CARD) | See URL | scratch | **VERIFY** | dataset-license-not-recorded |
| [is_IS-steinn-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/is/is_IS/steinn/medium/MODEL_CARD) | See URL | scratch | **VERIFY** | dataset-license-not-recorded |
| [is_IS-ugla-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/is/is_IS/ugla/medium/MODEL_CARD) | See URL | scratch | **VERIFY** | dataset-license-not-recorded |
| [it_IT-paola-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/it/it_IT/paola/medium/MODEL_CARD) | See URL | finetuned from en_US-lessac-medium | **NOT OK** | dataset-license-not-recorded, lessac-lineage |
| [it_IT-riccardo-x_low](https://huggingface.co/rhasspy/piper-voices/blob/main/it/it_IT/riccardo/x_low/MODEL_CARD) | See URL | scratch | **VERIFY** | dataset-license-not-recorded |
| [it_IT-serena-high](https://huggingface.co/rhasspy/piper-voices/blob/main/it/it_IT/serena/high/MODEL_CARD) | CC-BY-4.0 | scratch | **VERIFY** | unreviewed |
| [it_IT-serena-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/it/it_IT/serena/medium/MODEL_CARD) | CC-BY-4.0 | scratch | **VERIFY** | unreviewed |
| [ja_JP-hi_fi_captain-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/ja/ja_JP/hi_fi_captain/medium/MODEL_CARD) | https://creativecommons.org/licenses/by… | finetuned from en_US-libritts_r-medium | **NOT OK** | dataset-nc |
| [ka_GE-natia-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/ka/ka_GE/natia/medium/MODEL_CARD) | See LICENSE file | finetuned from en_US-lessac-medium | **NOT OK** | dataset-license-not-recorded, lessac-lineage |
| [kk_KZ-iseke-x_low](https://huggingface.co/rhasspy/piper-voices/blob/main/kk/kk_KZ/iseke/x_low/MODEL_CARD) | CC-BY-4.0 | scratch | **VERIFY** | unreviewed |
| [kk_KZ-issai-high](https://huggingface.co/rhasspy/piper-voices/blob/main/kk/kk_KZ/issai/high/MODEL_CARD) | CC-BY-4.0 | scratch | **VERIFY** | unreviewed |
| [kk_KZ-raya-x_low](https://huggingface.co/rhasspy/piper-voices/blob/main/kk/kk_KZ/raya/x_low/MODEL_CARD) | CC-BY-4.0 | scratch | **VERIFY** | unreviewed |
| [ko_KR-kss-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/ko/ko_KR/kss/medium/MODEL_CARD) | https://creativecommons.org/licenses/by… | finetuned from en_US-libritts_r-medium | **NOT OK** | dataset-nc |
| [ku_TR-berfin_renas-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/ku/ku_TR/berfin_renas/medium/MODEL_CARD) | not stated | unknown | **NOT OK** | dataset-license-unknown |
| [lb_LU-marylux-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/lb/lb_LU/marylux/medium/MODEL_CARD) | http://creativecommons.org/licenses/by-… | finetuned from en_US-lessac-medium | **NOT OK** | dataset-nc |
| [lt_LT-ingute-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/lt/lt_LT/ingute/medium/MODEL_CARD) | NewGenLTU Open RAIL-D License 1.0 | finetuned from en_US-lessac-medium | **NOT OK** | dataset-copyleft, lessac-lineage |
| [lt_LT-reginute1-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/lt/lt_LT/reginute1/medium/MODEL_CARD) | CC-BY-4.0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [lv_LV-aivars-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/lv/lv_LV/aivars/medium/MODEL_CARD) | CC0 1.0 Universal | unknown | **VERIFY** | unreviewed |
| [ml_IN-arjun-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/ml/ml_IN/arjun/medium/MODEL_CARD) | See URL | finetuned from en_US-lessac-medium | **NOT OK** | dataset-license-not-recorded, lessac-lineage |
| [ml_IN-meera-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/ml/ml_IN/meera/medium/MODEL_CARD) | See URL | finetuned from en_US-lessac-medium | **NOT OK** | dataset-license-not-recorded, lessac-lineage |
| [mr_IN-google-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/mr/mr_IN/google/medium/MODEL_CARD) | Attribution-ShareAlike 4.0 International | finetuned from en_US-libritts_r-medium | **NOT OK** | dataset-share-alike, lessac-lineage |
| [ne_NP-chitwan-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/ne/ne_NP/chitwan/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [ne_NP-google-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/ne/ne_NP/google/medium/MODEL_CARD) | CC-BY-SA-4.0 International | finetuned from en_US-lessac-medium | **NOT OK** | dataset-share-alike, lessac-lineage |
| [ne_NP-google-x_low](https://huggingface.co/rhasspy/piper-voices/blob/main/ne/ne_NP/google/x_low/MODEL_CARD) | CC-BY-SA-4.0 International | scratch | **VERIFY** | dataset-share-alike |
| [nl_BE-nathalie-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/nl/nl_BE/nathalie/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [nl_BE-nathalie-x_low](https://huggingface.co/rhasspy/piper-voices/blob/main/nl/nl_BE/nathalie/x_low/MODEL_CARD) | CC0 | scratch | **VERIFY** | unreviewed |
| [nl_BE-rdh-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/nl/nl_BE/rdh/medium/MODEL_CARD) | CC0 1.0 Universal | scratch | **VERIFY** | unreviewed |
| [nl_BE-rdh-x_low](https://huggingface.co/rhasspy/piper-voices/blob/main/nl/nl_BE/rdh/x_low/MODEL_CARD) | CC0 1.0 Universal | scratch | **VERIFY** | unreviewed |
| [nl_NL-alex-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/nl/nl_NL/alex/medium/MODEL_CARD) | CC0 | finetuned from nl_BE-rdh-medium | **VERIFY** | unreviewed |
| [nl_NL-mls-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/nl/nl_NL/mls/medium/MODEL_CARD) | CC-BY 4.0 | scratch | **OK** | none |
| [nl_NL-mls_5809-low](https://huggingface.co/rhasspy/piper-voices/blob/main/nl/nl_NL/mls_5809/low/MODEL_CARD) | CC BY 4.0 | finetuned from en_US-ryan-low | **NOT OK** | nc-lineage |
| [nl_NL-mls_7432-low](https://huggingface.co/rhasspy/piper-voices/blob/main/nl/nl_NL/mls_7432/low/MODEL_CARD) | CC BY 4.0 | finetuned from en_US-ryan-low | **NOT OK** | nc-lineage |
| [nl_NL-pim-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/nl/nl_NL/pim/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [nl_NL-ronnie-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/nl/nl_NL/ronnie/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [no_NO-nvcc-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/no/no_NO/nvcc/medium/MODEL_CARD) | CC0 | scratch | **VERIFY** | unreviewed |
| [no_NO-talesyntese-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/no/no_NO/talesyntese/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [pl_PL-bass-high](https://huggingface.co/rhasspy/piper-voices/blob/main/pl/pl_PL/bass/high/MODEL_CARD) | not stated | unknown | **NOT OK** | dataset-license-unknown |
| [pl_PL-darkman-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/pl/pl_PL/darkman/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [pl_PL-gosia-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/pl/pl_PL/gosia/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [pl_PL-mc_speech-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/pl/pl_PL/mc_speech/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [pl_PL-mls_6892-low](https://huggingface.co/rhasspy/piper-voices/blob/main/pl/pl_PL/mls_6892/low/MODEL_CARD) | CC BY 4.0 | finetuned from en_US-ryan-low | **NOT OK** | nc-lineage |
| [pt_BR-cadu-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/pt/pt_BR/cadu/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [pt_BR-edresson-low](https://huggingface.co/rhasspy/piper-voices/blob/main/pt/pt_BR/edresson/low/MODEL_CARD) | CC BY 4.0 | finetuned from en_US-ryan-low | **NOT OK** | nc-lineage |
| [pt_BR-faber-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/pt/pt_BR/faber/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [pt_BR-jeff-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/pt/pt_BR/jeff/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [pt_PT-tugão-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/pt/pt_PT/tugão/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [ro_RO-mihai-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/ro/ro_RO/mihai/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [ru_RU-denis-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/ru/ru_RU/denis/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [ru_RU-dmitri-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/ru/ru_RU/dmitri/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [ru_RU-irina-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/ru/ru_RU/irina/medium/MODEL_CARD) | Unknown | finetuned from en_US-lessac-medium | **NOT OK** | dataset-license-unknown, lessac-lineage |
| [ru_RU-ruslan-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/ru/ru_RU/ruslan/medium/MODEL_CARD) | https://creativecommons.org/licenses/by… | finetuned from en_US-lessac-medium | **NOT OK** | dataset-nc |
| [sk_SK-lili-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/sk/sk_SK/lili/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [sl_SI-artur-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/sl/sl_SI/artur/medium/MODEL_CARD) | https://creativecommons.org/licenses/by… | unknown | **VERIFY** | unreviewed |
| [sq_AL-edon-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/sq/sq_AL/edon/medium/MODEL_CARD) | CC0 | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [sr_RS-serbski_institut-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/sr/sr_RS/serbski_institut/medium/MODEL_CARD) | https://creativecommons.org/licenses/by… | finetuned from en_US-lessac-medium | **NOT OK** | dataset-nc |
| [sv_SE-alma-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/sv/sv_SE/alma/medium/MODEL_CARD) | not stated | unknown | **NOT OK** | dataset-license-unknown |
| [sv_SE-lisa-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/sv/sv_SE/lisa/medium/MODEL_CARD) | not stated | finetuned from no_NO-talesyntese-medium | **NOT OK** | dataset-license-unknown, lessac-lineage |
| [sv_SE-nst-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/sv/sv_SE/nst/medium/MODEL_CARD) | CC0 | scratch | **VERIFY** | unreviewed |
| [sw_CD-lanfrica-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/sw/sw_CD/lanfrica/medium/MODEL_CARD) | See URL | finetuned from en_US-lessac-medium | **NOT OK** | dataset-license-not-recorded, lessac-lineage |
| [te_IN-maya-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/te/te_IN/maya/medium/MODEL_CARD) | www.iitm.ac.in/donlab/indictts/download… | finetuned from en_US-lessac-medium | **NOT OK** | dataset-license-not-recorded, lessac-lineage |
| [te_IN-padmavathi-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/te/te_IN/padmavathi/medium/MODEL_CARD) | CC-BY-4.0 | unknown | **VERIFY** | unreviewed |
| [te_IN-venkatesh-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/te/te_IN/venkatesh/medium/MODEL_CARD) | CC-BY-4.0 | unknown | **VERIFY** | unreviewed |
| [th_TH-tsync2-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/th/th_TH/tsync2/medium/MODEL_CARD) | CC BY-NC-SA 3.0 (**non-commercial**) | finetuned from en_US-libritts_r-medium | **NOT OK** | dataset-nc |
| [tr_TR-dfki-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/tr/tr_TR/dfki/medium/MODEL_CARD) | https://creativecommons.org/licenses/by… | finetuned from en_US-lessac-medium | **NOT OK** | dataset-nc |
| [uk_UA-lada-x_low](https://huggingface.co/rhasspy/piper-voices/blob/main/uk/uk_UA/lada/x_low/MODEL_CARD) | Apache 2.0 | scratch | **VERIFY** | unreviewed |
| [uk_UA-mykyta-high](https://huggingface.co/rhasspy/piper-voices/blob/main/uk/uk_UA/mykyta/high/MODEL_CARD) | Apache 2.0 | unknown | **VERIFY** | unreviewed |
| [uk_UA-oleksa-high](https://huggingface.co/rhasspy/piper-voices/blob/main/uk/uk_UA/oleksa/high/MODEL_CARD) | Apache 2.0 | unknown | **VERIFY** | unreviewed |
| [uk_UA-tetiana-high](https://huggingface.co/rhasspy/piper-voices/blob/main/uk/uk_UA/tetiana/high/MODEL_CARD) | Apache 2.0 | unknown | **VERIFY** | unreviewed |
| [uk_UA-ukrainian_tts-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/uk/uk_UA/ukrainian_tts/medium/MODEL_CARD) | CC0 | scratch | **VERIFY** | unreviewed |
| [ur_PK-aegis_female-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/ur/ur_PK/aegis_female/medium/MODEL_CARD) | not stated | unknown | **NOT OK** | dataset-license-unknown |
| [ur_PK-fasih-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/ur/ur_PK/fasih/medium/MODEL_CARD) | not stated | finetuned from hi_IN-rohan-medium | **NOT OK** | dataset-license-unknown, lessac-lineage |
| [vi_VN-25hours_single-low](https://huggingface.co/rhasspy/piper-voices/blob/main/vi/vi_VN/25hours_single/low/MODEL_CARD) | Unknown | finetuned from en_US-ryan-low | **NOT OK** | dataset-license-unknown, nc-lineage |
| [vi_VN-vais1000-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/vi/vi_VN/vais1000/medium/MODEL_CARD) | https://creativecommons.org/licenses/by… | finetuned from en_US-lessac-medium | **NOT OK** | lessac-lineage |
| [vi_VN-vivos-x_low](https://huggingface.co/rhasspy/piper-voices/blob/main/vi/vi_VN/vivos/x_low/MODEL_CARD) | CC BY-NC-SA 4.0 | scratch | **NOT OK** | dataset-nc |
| [zh_CN-chaowen-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/zh/zh_CN/chaowen/medium/MODEL_CARD) | CC0 | finetuned from zh_CN-xiao_ya-medium | **NOT OK** | nc-lineage |
| [zh_CN-huayan-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/zh/zh_CN/huayan/medium/MODEL_CARD) | Unknown | finetuned from en_US-lessac-medium | **NOT OK** | dataset-license-unknown, lessac-lineage |
| [zh_CN-huayan-x_low](https://huggingface.co/rhasspy/piper-voices/blob/main/zh/zh_CN/huayan/x_low/MODEL_CARD) | Unknown | scratch | **NOT OK** | dataset-license-unknown |
| [zh_CN-xiao_ya-medium](https://huggingface.co/rhasspy/piper-voices/blob/main/zh/zh_CN/xiao_ya/medium/MODEL_CARD) | Non-commercial use (see https://www.dat… | scratch | **NOT OK** | dataset-nc |
<!-- END GENERATED: other -->

## 5. CMU Pronouncing Dictionary (CMUdict)

| Item | Result |
|---|---|
| What it is | `cmusphinx/cmudict`, "CMU US English Dictionary", maintained by the CMU Speech Group. A pronouncing dictionary (word to ARPAbet phonemes) usable as a non-GPL grapheme-to-phoneme lookup for English instead of eSpeak NG. |
| Licence file (`LICENSE`, verified 2026-10-24) | 2-clause BSD style: "Copyright (C) 1993-2015 Carnegie Mellon University. All rights reserved. Redistribution and use in source and binary forms, with or without modification, are permitted provided that ... 1. Redistributions of source code must retain the above copyright notice and the following disclaimer. The contents of this file are deemed to be source code. 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution." The file also contains a funding acknowledgement (DARPA, ONR, NSF, Sphinx Speech Consortium); keep it with the licence text. No advertising clause. |
| `README` | "Use of this dictionary for any research or commercial purpose is completely unrestricted. If you make use of or redistribute this material we request that you acknowledge its origin in your descriptions." |
| GitHub licence detection | `NOASSERTION` ("Other"): GitHub does not recognise the text, which is normal for this file; it is not a missing licence. |
| Attribution requirement | Keep the copyright line, the two conditions and the disclaimer with any copy of the data, and reproduce them in the in-app licenses screen (a binary form). Mention CMU as the origin. |
| Variants | Do **not** assume all "cmudict" copies share this text. `cmusphinx/cmudict` (GitHub, `cmudict.dict`, `cmudict.vp`) has the LICENSE above. Other redistributions (NLTK corpus, the `cmudict` PyPI package, the old `cmudict-0.7b` file on SourceForge/SVN, npm `cmu-pronouncing-dictionary` declared ISC) are wrappers whose declared licence may differ from the data's. For the wrapper `cmu-pronouncing-dictionary@3.0.0` the registry says ISC; the dictionary inside is still CMU's. The SourceForge copy could not be fetched, so its header is **UNVERIFIED**. Use the GitHub files and copy the LICENSE text verbatim. |
| Where it would be used | Not used yet; no code references it. Candidate for the non-GPL phoneme path of Decision 8 (English only; words not in the dictionary need a rule-based or learned fallback, which must be separately licensed; for example `g2p_en`/`Kyubyong/g2p` is Apache-2.0 per the GitHub API, but its model files and data were not checked). |
| Verdict | **OK** (attribution required). Registry row: `cmudict`. |

## 6. Engines, libraries and other models

<!-- BEGIN GENERATED: components -->
| Component | Kind | License | Verdict | Why | Evidence |
|---|---|---|---|---|---|
| rhasspy/piper (archived) | engine | MIT | **OK** | LICENSE.md is MIT (Copyright 2022 Michael Hansen); GitHub API: license MIT, archived. Code only; it needs a phonemizer (see espeak-ng). | [src1](https://raw.githubusercontent.com/rhasspy/piper/master/LICENSE.md) |
| OHF-Voice/piper1-gpl (piper-tts 1.3+) | engine | GPL-3.0-or-later | **NOT OK** | COPYING is the GPL v3 text; GitHub API: GPL-3.0. Embeds espeak-ng. Must not be bundled in the MIT PWA (training tool the user runs is fine). | [src1](https://raw.githubusercontent.com/OHF-Voice/piper1-gpl/main/COPYING) |
| rhasspy/piper-phonemize | library | MIT own code (LICENSE.md), links GPL espeak-ng | **NOT OK** | LICENSE.md is MIT (Copyright 2023 Michael Hansen) but CMakeLists.txt downloads and builds a rhasspy fork of espeak-ng into the library, so any built binary or WASM is a GPL-3.0 combined work. Repo archived; README says espeak-ng is now embedded in piper1-gpl. | [src1](https://github.com/rhasspy/piper-phonemize/blob/master/LICENSE.md) [src2](https://github.com/rhasspy/piper-phonemize/blob/master/CMakeLists.txt) [src3](https://github.com/rhasspy/piper-phonemize) |
| espeak-ng (code, data and WASM builds) | library | GPL-3.0-or-later | **NOT OK** | README: 'eSpeak NG Text-to-Speech is released under the GPL version 3 or later license.' Decision 8: nothing GPL is added to main before the decision is recorded. | [src1](https://github.com/espeak-ng/espeak-ng#license-information) [src2](https://raw.githubusercontent.com/espeak-ng/espeak-ng/master/COPYING) |
| phonemizer (npm, xenova/phonemizer.js) | library | Apache-2.0 declared, embeds GPL espeak-ng | **NOT OK** | package.json and LICENSE say Apache-2.0, but dist/phonemizer.js (1.3 MB) embeds the eSpeak NG WASM and its espeak-ng-data; the upstream issue 'Invalid license' (#6) states it must be GPL. Used by kokoro-js. | [src1](https://registry.npmjs.org/phonemizer/1.2.1) [src2](https://github.com/xenova/phonemizer.js/issues/6) |
| kokoro-js (npm) | library | Apache-2.0 | **NOT OK** | Apache-2.0 itself (registry: license Apache-2.0), but its dependencies are phonemizer ^1.2.1 (embeds GPL espeak-ng) and @huggingface/transformers. Not OK while phonemizer is required. | [src1](https://registry.npmjs.org/kokoro-js/latest) |
| onnxruntime-web | library | MIT | **OK** | npm registry: license MIT (1.30.0); microsoft/onnxruntime LICENSE is MIT (Copyright Microsoft Corporation). Self-host the .wasm files. | [src1](https://registry.npmjs.org/onnxruntime-web/latest) [src2](https://raw.githubusercontent.com/microsoft/onnxruntime/main/LICENSE) |
| @huggingface/transformers (transformers.js) | library | Apache-2.0 | **OK** | LICENSE is the Apache License 2.0. Loads models from the Hugging Face hub by default; PageNest would have to point it at registered, self-approved URLs. | [src1](https://github.com/huggingface/transformers.js/blob/main/LICENSE) |
| k2-fsa/sherpa-onnx | engine | Apache-2.0 | **VERIFY** | GitHub API: Apache-2.0. Its Piper (vits-piper) path uses an espeak-ng-data folder shipped with the model package (see wasm/tts/CMakeLists.txt comment), so GPL data may come along. Not verified further. | [src1](https://github.com/k2-fsa/sherpa-onnx) |
| diffusionstudio/piper-wasm and similar browser ports | library | none stated; build script compiles rhasspy/espeak-ng | **NOT OK** | GitHub API reports no license; build/README clone and compile rhasspy/espeak-ng and piper-phonemize into the WASM. Without a licence file nothing can be redistributed, and the espeak-ng part is GPL. | [src1](https://github.com/diffusionstudio/piper-wasm) |
| Kokoro-82M weights (hexgrad/Kokoro-82M, onnx-community/Kokoro-82M-v1.0-ONNX) | weights | Apache-2.0 | **OK** | Hugging Face tags and card front matter: license apache-2.0 (both repos); code hexgrad/kokoro is Apache-2.0. Card: trained on permissive or non-copyrighted audio incl. synthetic audio from closed TTS models; lists CC BY audio (Koniwa tnc <1h CC BY 3.0, SIWIS <11h CC BY 4.0). Keep that credit in the licenses screen. Re-check the… | [src1](https://huggingface.co/hexgrad/Kokoro-82M) [src2](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) [src3](https://raw.githubusercontent.com/hexgrad/kokoro/main/LICENSE) |
| Chatterbox (ResembleAI/chatterbox) | weights | MIT | **OK** | Hugging Face tag license:mit (sha 5bb1f6ee); resemble-ai/chatterbox repo license MIT. Output is watermarked with Resemble's PerTh watermark (README). Training data is not documented on the card; Voice Helper only, never shipped in the PWA. | [src1](https://huggingface.co/ResembleAI/chatterbox) [src2](https://github.com/resemble-ai/chatterbox) |
| Orpheus TTS 3B (canopylabs/orpheus-3b-0.1-ft) | weights | apache-2.0 tag on a Llama 3.2 base | **NOT OK** | HF API: license apache-2.0 but base_model meta-llama/Llama-3.2-3B-Instruct, so the Llama 3.2 Community License also applies (Decision 8 excludes it). The model card is gated and could not be read; the github repo canopyai/Orpheus-TTS is Apache-2.0. | [src1](https://huggingface.co/canopylabs/orpheus-3b-0.1-ft) [src2](https://github.com/canopyai/Orpheus-TTS) |
| CMU Pronouncing Dictionary (cmusphinx/cmudict) | dictionary | BSD-2-Clause style (CMU) | **OK** | LICENSE is a 2-clause BSD licence (Copyright 1993-2015 Carnegie Mellon University); README: 'Use of this dictionary for any research or commercial purpose is completely unrestricted' and asks for acknowledgement. Keep the copyright, conditions and disclaimer in source and in the app's licenses screen. | [src1](https://raw.githubusercontent.com/cmusphinx/cmudict/master/LICENSE) [src2](https://raw.githubusercontent.com/cmusphinx/cmudict/master/README) |
<!-- END GENERATED: components -->

Kokoro, Chatterbox and Orpheus in short:

- **Kokoro-82M** (Tier 2): weights Apache-2.0 (tag `license:apache-2.0` on `hexgrad/Kokoro-82M` and `onnx-community/Kokoro-82M-v1.0-ONNX`). The card says it was trained on "permissive/non-copyrighted audio" including "synthetic audio generated by closed TTS models from large providers" and lists CC BY audio (Koniwa tnc, SIWIS). Whether the closed providers' terms allow that is a statement by the author that was **not verifiable** here. The ONNX export is a third-party repo: re-check the tag at download time. The engine needs a phonemizer: `kokoro-js` brings GPL eSpeak NG (Decision 8).
- **Chatterbox** (Tier 3, Voice Helper only): MIT tag, MIT repository; the card does not document training data (UNVERIFIED); output carries the PerTh watermark.
- **Orpheus 3B**: NOT OK (Llama 3.2 base; Decision 8). The Hugging Face card is gated, so only the API fields (`license: apache-2.0`, `base_model: meta-llama/Llama-3.2-3B-Instruct`) were read.

## 7. Required in-app attribution for OK items

<!-- BEGIN GENERATED: attribution -->
- **de_DE-mls-medium**: Multilingual LibriSpeech (Pratap et al., 2020), CC BY 4.0, https://www.openslr.org/94/
- **en_GB-cori-high**: Voice trained by Bryce Beattie from LibriVox recordings (public domain); attribution not required, courtesy credit recommended.
- **en_GB-cori-medium**: Voice trained by Bryce Beattie from LibriVox recordings (public domain); attribution not required, courtesy credit recommended.
- **en_US-john-medium**: Voice trained by Bryce Beattie from LibriVox recordings (public domain); attribution not required, courtesy credit recommended.
- **en_US-kristin-medium**: Voice trained by Bryce Beattie from LibriVox recordings (public domain); attribution not required, courtesy credit recommended.
- **en_US-libritts-high**: LibriTTS corpus (Zen et al., 2019), CC BY 4.0, https://www.openslr.org/60/
- **en_US-ljspeech-high**: LJ Speech Dataset (Keith Ito), public domain; courtesy credit recommended.
- **en_US-ljspeech-medium**: LJ Speech Dataset (Keith Ito), public domain; courtesy credit recommended.
- **en_US-norman-medium**: Voice trained by Bryce Beattie from LibriVox recordings (public domain); attribution not required, courtesy credit recommended.
- **fr_FR-mls-medium**: Multilingual LibriSpeech (Pratap et al., 2020), CC BY 4.0, https://www.openslr.org/94/
- **nl_NL-mls-medium**: Multilingual LibriSpeech (Pratap et al., 2020), CC BY 4.0, https://www.openslr.org/94/
- **Kokoro-82M weights (hexgrad/Kokoro-82M, onnx-community/Kokoro-82M-v1.0-ONNX)**: Kokoro-82M by hexgrad (Apache-2.0); training data credits: Koniwa tnc (CC BY 3.0), SIWIS (CC BY 4.0).
- **CMU Pronouncing Dictionary (cmusphinx/cmudict)**: The Carnegie Mellon Pronouncing Dictionary, Copyright (C) 1993-2015 Carnegie Mellon University, BSD-style licence (https://github.com/cmusphinx/cmudict).
<!-- END GENERATED: attribution -->

## 8. Review of `docs/NARRATION_SPIKE.md` (branch `feature/narration-spike`, 2fcbaca)

Each licence claim in the spike was checked against its primary source on 2026-10-24. Summary: no claim about the main engines is wrong, but two are incomplete or misleading and one important claim is missing (voice lineage). The spike contains no model URLs, hosts or dependencies in code, so there was nothing to fail in the code scan.

| # | Claim in the spike | Verdict | Evidence |
|---|---|---|---|
| 1 | `rhasspy/piper` (archived) is MIT | CORRECT | `LICENSE.md`: "MIT License, Copyright (c) 2022 Michael Hansen"; GitHub API: MIT, archived=true. https://raw.githubusercontent.com/rhasspy/piper/master/LICENSE.md |
| 2 | `OHF-Voice/piper1-gpl` is GPL-3.0-or-later | CORRECT for GPL-3.0; "or later" UNVERIFIED | `COPYING` is "GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007"; GitHub API: GPL-3.0. Neither COPYING, `pyproject.toml` nor the README states "or later"; check the source file headers if it ever matters (it does not change the MIT-PWA conclusion). https://raw.githubusercontent.com/OHF-Voice/piper1-gpl/main/COPYING |
| 3 | eSpeak NG is GPL-3.0-or-later; eSpeak language data GPL | CORRECT | README: "eSpeak NG Text-to-Speech is released under the GPL version 3 or later license." https://github.com/espeak-ng/espeak-ng#license-information |
| 4 | piper-phonemize has "no LICENSE at master/LICENSE (404)"; "treat as GPL with eSpeak" | PARTLY WRONG | The repo has `LICENSE.md` (not `LICENSE`): "MIT License, Copyright (c) 2023 Michael Hansen", and GitHub reports MIT. The conclusion (GPL in the built artefact) is still right, because CMakeLists.txt downloads and builds `rhasspy/espeak-ng` into it. https://github.com/rhasspy/piper-phonemize/blob/master/LICENSE.md |
| 5 | ONNX Runtime Web is MIT | CORRECT | npm registry: `onnxruntime-web@1.30.0` license MIT; `microsoft/onnxruntime` LICENSE: "MIT License, Copyright (c) Microsoft Corporation". |
| 6 | Piper voices: "Per voice (e.g. LibriTTS-derived MIT Piper voices)"; "many CC BY / dataset-specific" | MISLEADING | The only licence the repository declares is the Hugging Face tag `license: mit` for the repository, and the card never says the *weights* are MIT. Voices are not "LibriTTS-derived MIT": `libritts_r/medium` is lessac-derived, and most voices are lessac or ryan descendants (section 1). The weights licence is not settled by upstream. https://huggingface.co/rhasspy/piper-voices |
| 7 | "Use per-voice LibriTTS / libritts_r checkpoints only" (recommendation 3) | WRONG for libritts_r | Use `en_US-libritts-high` (scratch, CC BY 4.0). `en_US-libritts_r-medium`: "Fine-tuned from English lessac medium on train-clean-360". |
| 8 | Never ship `en_US-lessac` (Blizzard 2013, research-only) | CORRECT | Licence text quoted in section 3. The spike does not mention that about 78 other voices descend from it. |
| 9 | Kokoro-82M weights are Apache-2.0; `hexgrad/kokoro` LICENSE | CORRECT | HF API `cardData.license: apache-2.0`, tags `license:apache-2.0`; `hexgrad/kokoro` LICENSE is "Apache License Version 2.0". |
| 10 | `kokoro-js` is Apache-2.0 (package) | CORRECT | `registry.npmjs.org/kokoro-js/latest`: license Apache-2.0, version 1.2.1, depends on `phonemizer ^1.2.1`. |
| 11 | `phonemizer.js`: "Apache-2.0 wrapper, bundled eSpeak NG GPL" | CORRECT | `package.json` and `LICENSE` Apache-2.0; `dist/phonemizer.js` (1.3 MB) contains `espeak-ng-data`; issue #6 "Invalid license". |
| 12 | `www.npmjs.com/package/kokoro-js` returned 403; use registry API | CORRECT (consistent) | The registry API is the right source. |
| 13 | Web Speech API needs no licence ("browser implementation") | CORRECT but UNVERIFIED as a legal claim | Platform API; voices belong to the OS or browser vendor and are not redistributable by PageNest, which is fine because nothing is bundled. |
| 14 | Download sizes ("~15-80 MB per voice", "~80-300 MB Kokoro") | UNVERIFIED | Not a licence claim. Sizes are in the registry for Piper (`onnxBytes`). |
| 15 | RTF figures (Eist, issue #352, Soniqo, `ductai199x/sidecoach-kokoro-fast`) | UNVERIFIED | Third-party benchmark claims, not licence claims; not checked. |
| 16 | Model download design: "SHA-256 integrity", "Decision 4: connect-src after Auditor approves hosts" | CORRECT (design) | `public/_headers` has `connect-src 'self' blob: data:` on main; `scripts/audit-allowlist.json` currently allows **all** of `huggingface.co` (and `*.hf.co`, GitHub releases/raw) for the privacy audit. `audit-models.mjs` now narrows this to registered repos and voices. Approve a host only together with a registry entry. |

Things the spike does not cover that block free distribution (summary of section 1): voice lineage (lessac/ryan descendants), NC-SA and share-alike datasets, the GPL phonemizer path, Orpheus (Llama licence), and the missing explicit weights licence for Piper voices.

## 9. Open questions for the owner

1. Accept the cautious "descends from lessac/ryan = NOT OK" reading, or get a legal opinion (a different answer would make roughly 78 more voices usable). Until then only the OK rows are usable.
2. Which voices should be offered at launch? Suggested: `en_US-libritts-high` (multi-speaker, 904 speakers), `en_US-kristin-medium`, `en_GB-cori-high`, `en_US-norman-medium`.
3. GPL phonemizer decision (Decision 8) is still open; this document does not change it.
4. Train an own voice from scratch with CC0/CC BY data (for example the OHF-Voice datasets) with the Voice Helper training script: that is the only way to get more clean voices, and the training tool must itself be permissive (Piper training is GPL).
