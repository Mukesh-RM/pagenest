# Phase 0–7 audit (vs `docs/BLUEPRINT.md` §18 and §20)

Last updated: **2026-11-02** (deploy **`f2a8e72`**, marks export + live smoke all-green).

| Phase | Status | Evidence | Honest gaps |
| --- | --- | --- | --- |
| **0 Foundation** | **Done** | PWA manifest + SW; offline e2e; install help; themes/nav/sheets | Real-device install icons — `docs/LAUNCH_CHECKLIST.md` |
| **1 Library & storage** | **Done** | Import workers, OPFS/Dexie, **share target** (`src/sw/share-target.ts`, `src/sw/e2e/pwa-shell.spec.mjs`, `tests/e2e/pwa.spec.ts`); backup UI + worker; **500 mixed import** (`src/features/library/e2e/import.spec.ts`, `phase1-acceptance.spec.ts`); 5k scroll (`tests/perf/library.spec.ts`) | 500 files on a **physical phone** without jank — manual |
| **2 Reader** | **Done** | All format engines + fixtures; resume; highlights/notes/bookmarks; **marks export** (`marks-export.ts`); reader e2e + 360 layout | 50 MB PDF &lt;1.5 s — local perf fixture (`make-large-pdf`) |
| **3 Audiobooks** | **Mostly done** | `AudioController`, Media Session, player UI; chapter parsers; release smoke MP3 path | **2 h locked-screen** on real iPhone + Android |
| **4 Read-aloud** | **Mostly done** | Device speech default; Piper path; sentence highlight (`sentence-highlight.ts`, `narration.css`); footer headphone + dock; live read-aloud smoke | Full chapter **screen off** — device manual |
| **5 Expressive narration** | **Done (code)** | Segmenter, tagger, planner tests; Natural / Expressive / **Cast voices** (`delivery-planner.ts`, `NarrationControls`) | Listening A/B “clearly better” — manual |
| **6 Voice Studio** | **Mostly done** | Consent, pack export/import, delete; e2e | On-device train + chapter in cloned voice — optional models |
| **7 Polish & launch** | **Partial** | Legal/privacy/licenses + **Language** panel (English UI, structure for locales); contrast tests; Lighthouse + excellence gates; live smoke PNGs; `docs/SECTION_20_STATUS.md`, `docs/LAUNCH_CHECKLIST.md` | Full i18n; device matrix; maintainer deploy ticks |

## Remaining blueprint work called out in this pass

| Theme | Where it lives |
| --- | --- |
| Highlights/notes **export** | `src/features/reader/live/marks-export.ts`, Marks sheet button |
| **500-file** library perf | `src/features/library/e2e/import.spec.ts` (500 mixed, no 50 ms long tasks) |
| **Share target** | `src/sw/share-target.ts` + SW e2e POST; **live** `release-smoke-live-share-target.spec.ts` |
| Sentence-highlight **polish** | `narration.css`, reduced-motion scroll in `sentence-highlight.ts` |
| More free **Piper voices** | `src/engines/tts/piper/voices.ts` (audit-OK set) |
| **Cast voices** (Phase 5) | `style: 'cast'` in delivery planner + narration UI |
| **Accessibility + localisation** | Contrast unit tests, Lighthouse a11y; `LanguageSettingsPanel` (English shipped) |
| **Section 20 launch checklist** | `docs/SECTION_20_STATUS.md`, `docs/LAUNCH_CHECKLIST.md` (manual device rows) |

Screenshots (360×740): `docs/screens/release-smoke-live/pagenest-42f.pages.dev/` and `docs/screens/audit-360/`.
