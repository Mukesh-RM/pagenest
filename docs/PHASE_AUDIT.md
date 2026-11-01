# Phase 0–7 audit (vs `docs/BLUEPRINT.md` §18 and §20)

Last updated: 2026-11-01 (branch `cursor/reader-360-audit-3f1e` / PR #18).

| Phase | Status | Evidence | Cannot complete free/offline (honest gaps) |
| --- | --- | --- | --- |
| **0 Foundation** | **Done** | PWA manifest + SW (`public/manifest.webmanifest`, `src/sw/sw.ts`); offline e2e (`tests/e2e/offline.spec.ts`, `src/sw/e2e/pwa-shell.spec.mjs`); install UI (`InstallHelp`); themes/nav/sheets in app shell | — |
| **1 Library & storage** | **Done** | Import workers, OPFS/Dexie, share target (`src/sw/share-target.ts`, `tests/e2e/pwa.spec.ts`); backup (`src/features/library/components/BackupRestorePanel.tsx`, `workers/import/backup.ts`); 5k query tests (`src/data/library-query-patch.test.ts`); perf scroll (`tests/perf/library.spec.ts`) | Proving **500 files on a real phone without jank** is manual; CI uses seeded perf fixtures |
| **2 Reader** | **Done** | Format engines + fixtures (PDF/EPUB/MOBI/FB2/DOCX/TXT/CBZ under `src/features/reader/`); resume (`ProgressService`); reader e2e matrix (`src/features/reader/e2e/`); 360px layout (`tests/e2e/reader-360-layout.spec.ts`) | **50 MB PDF &lt;1.5 s** enforced in perf tests when large fixture is built locally (`make-large-pdf`); not in every CI run |
| **3 Audiobooks** | **Mostly done** | `AudioController`, Media Session, player UI; seed player e2e (`tests/e2e/audit-360-screens.spec.ts` shot 04); chapter parsers tested | **2 h locked-screen on real iPhone + Android** with lock/BT controls — requires physical devices; not automatable in CI |
| **4 Read-aloud** | **Mostly done** | Piper worker path, narration session, Opus cache; unit/integration tests under `src/features/narration/` and `src/engines/tts/` | **Full chapter with screen off** needs device + downloaded Piper model; CI uses mocks/stubs where models absent |
| **5 Expressive narration** | **Done (code)** | Segmenter/tagger/planner tests; Natural vs Expressive toggle; **Cast voices** UI (`NarrationControls` + `style: 'cast'`) | **Listening-test “clearly better”** is subjective; automated A/B not in CI |
| **6 Voice Studio** | **Mostly done** | Consent flow, pack export/import, delete; e2e (`src/features/voice-studio/e2e/voice-studio.spec.ts`) | **Train clone on-device** depends on optional helper/models (~55 MB); full chapter in cloned voice = manual with models |
| **7 Polish & launch** | **Partial → shipping in PR #18** | Legal/privacy/licenses + language panels (`LegalSettingsPanel`, `LanguageSettingsPanel`); a11y contrast tests (`src/ui/styles/contrast.test.ts`); excellence/ Lighthouse in `tests/`; 360px audit shots `docs/screens/audit-360/` | **Full i18n** (non-English UI) not shipped — English + structure only; **device matrix** (Xiaomi battery, etc.) manual; **hosting deploy** is maintainer action on Cloudflare Pages |

## Section 20 Definition of Done (tick map)

| Item | In CI / code | Notes |
| --- | --- | --- |
| Install + offline &lt;1 s | Partial | `PAGENEST_LAUNCH_BUDGET_MS` in `tests/e2e/offline.spec.ts`; PWA Lighthouse in blocking CI |
| No login/ads/analytics/payments | Yes | License audit scripts; no third-party trackers in app code |
| All listed formats + DRM message | Yes | `format-guard`, reader fixtures, DRM handler |
| Exact resume after kill | Yes | Progress service + e2e resume specs |
| 2 h locked audiobook | No (manual) | See Phase 3 |
| Read-aloud screen off | No (manual) | See Phase 4 |
| Expressive &gt; Natural | Manual listening | See Phase 5 |
| Voice Studio train + chapter | Partial | E2E without full ONNX train in CI |
| Backup restores all | Yes | Backup worker tests + library UI |
| 5,000-book scroll | Yes | `tests/perf/library.spec.ts`, Dexie patch tests |
| Screen reader + contrast | Partial | Contrast unit tests + Lighthouse a11y ≥90 target; full SR walkthrough manual |

Screenshots (360×740): see `docs/screens/audit-360/*.png` and PR #18 body.
