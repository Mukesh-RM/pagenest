# Phase 0–7 audit (vs `docs/BLUEPRINT.md` §18 and §20)

Last updated: **2026-11-02** (deploy **`d16fb55`**; clone gates + post-launch phone path in progress).

| Phase | Status | Evidence | Honest gaps |
| --- | --- | --- | --- |
| **0 Foundation** | **Done** | PWA manifest + SW; offline e2e; install help; themes/nav/sheets | Real-device install icons — `docs/LAUNCH_CHECKLIST.md` |
| **1 Library & storage** | **Done** | Import workers, OPFS/Dexie, **share target** (+ live smoke); backup; **500 mixed import** (`import.spec.ts`); 5k scroll (`tests/perf/library.spec.ts`) | 500 files on a **physical phone** without jank — manual |
| **2 Reader** | **Done** | All format engines; resume; marks + **export**; **50 MB PDF** open &lt;1.5 s (`reader/e2e/pdf.spec.mjs`) | Real-device kill/resume matrix |
| **3 Audiobooks** | **Mostly done** | `AudioController`, Media Session, player UI; **wake lock** on play | **2 h locked-screen** on real iPhone + Android |
| **4 Read-aloud** | **Mostly done** | Device speech + Piper; highlight; footer + dock; live smoke; Media Session + wake lock | Full chapter **screen off** — device manual |
| **5 Expressive narration** | **Done (code)** | Segmenter, tagger, planner; Natural / Expressive / **Cast** | Listening A/B — manual |
| **6 Voice Studio** | **Partial (launch)** | Consent, guided record, pack **export/import**, delete (`voice-pack.ts`) | **Phone clone not shipped:** lite preview gated (`clone-shipping.ts`); real SpeechT5+x-vector read-aloud is **post-launch** (`VITE_PN_PHONE_VOICE_CLONE`). Route A (PC train) optional extra only. |
| **7 Polish & launch** | **Partial** | Legal/privacy/licenses; `uiMessage` / `messages/en.ts`; contrast + Lighthouse; live smoke @ **`d16fb55`** | Full locale catalogs; device matrix |

## Voice clone (owner rule)

| Item | Status |
| --- | --- |
| Users hear fake lite tone | **Blocked** — `Train on device` + **My voice** read-aloud hidden unless `VITE_PN_VOICE_CLONE_PREVIEW=1` (dev) |
| Train + run on phone, free, offline | **Post-launch update** — `VITE_PN_PHONE_VOICE_CLONE=1` builds; see `docs/PHONE_VOICE_CLONE.md` |
| My Voice Pack (PC/Colab) | Optional export only; not the primary path |

Screenshots: `docs/screens/release-smoke-live/pagenest-42f.pages.dev/`.
