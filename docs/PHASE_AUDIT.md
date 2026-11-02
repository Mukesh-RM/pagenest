# Phase 0–7 audit (vs `docs/BLUEPRINT.md` §18 and §20)

Last updated: **2026-11-02** (deploy **`f2a8e72`** + **#48** SW/chunk root fix, gap batch).

| Phase | Status | Evidence | Honest gaps |
| --- | --- | --- | --- |
| **0 Foundation** | **Done** | PWA manifest + SW; offline e2e; install help; themes/nav/sheets | Real-device install icons — `docs/LAUNCH_CHECKLIST.md` |
| **1 Library & storage** | **Done** | Import workers, OPFS/Dexie, **share target** (+ live smoke); backup; **500 mixed import** (`import.spec.ts`); 5k scroll (`tests/perf/library.spec.ts`) | 500 files on a **physical phone** without jank — manual |
| **2 Reader** | **Done** | All format engines; resume; marks + **export**; **50 MB PDF** open &lt;1.5 s (`reader/e2e/pdf.spec.mjs`, `make-large-pdf.mjs`) | Real-device kill/resume matrix |
| **3 Audiobooks** | **Mostly done** | `AudioController`, Media Session, player UI; **wake lock** on play (`use-playback-wake-lock.ts`) | **2 h locked-screen** on real iPhone + Android |
| **4 Read-aloud** | **Mostly done** | Device speech + Piper; highlight; footer + dock; live smoke; **Media Session + wake lock while reading** (`narration-media-session.ts`) | Full chapter **screen off** — device manual |
| **5 Expressive narration** | **Done (code)** | Segmenter, tagger, planner; Natural / Expressive / **Cast** (`pipeline.test.ts`) | Listening A/B “clearly better” — manual |
| **6 Voice Studio** | **Mostly done** | Consent, pack export/import, delete; **`trainVoiceOnDevice`** (`train-on-device.ts`, UI button) | Full SpeechT5 chapter in cloned voice without optional ONNX download |
| **7 Polish & launch** | **Partial** | Legal/privacy/licenses; **`uiMessage` / `messages/en.ts`**; contrast + Lighthouse; live smoke; `SECTION_20_STATUS.md` | Full locale catalogs; device matrix; maintainer deploy ticks |

## SW update / stale chunk fix (#41 follow-up in #48)

| Piece | Where |
| --- | --- |
| Precache snapshot before Workbox cleanup | `src/sw/preserve-precache.ts`, activate listener in `sw.ts` |
| Updates wait for `SKIP_WAITING` (not mid-tab `skipWaiting`) | `sw.ts` install handler |
| All route lazy chunks use `importModule` | `lazy-with-retry.ts`, `screens.ts`, routes, player, reader |
| Release smoke applies update like a user | `bumpServiceWorker` posts `SKIP_WAITING` |

Screenshots: `docs/screens/release-smoke-live/pagenest-42f.pages.dev/`.
