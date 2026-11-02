# Blueprint section 20 — Definition of Done (status)

Tracked against **`dfe1b23`** on `https://pagenest-42f.pages.dev/`. Automated evidence links point at CI, perf gates, and live smoke docs.

| Item | Status | Evidence |
| --- | --- | --- |
| Installs from a link; offline launch &lt;1 s | **Partial** | PWA manifest + SW (`public/manifest.webmanifest`, `src/sw/sw.ts`); `tests/e2e/offline.spec.ts` (`PAGENEST_LAUNCH_BUDGET_MS`); Lighthouse PWA ≥90 in blocking CI |
| No login, ads, analytics, payments | **Yes** | `scripts/audit-privacy.mjs`; no third-party trackers in app source |
| Opens PDF, EPUB, MOBI, FB2, DOCX, TXT, CBZ; DRM message | **Yes** | Reader fixtures + `DocumentEngine` (`b4af337`); live format shots `release-smoke-*-formats-*-open.png`; DRM copy in `src/features/reader/core/errors.ts` |
| Exact resume after kill | **Yes** | `ProgressService`; `release-smoke-live-upgrade.spec.ts` resume assert |
| 2 h locked audiobook + lock/BT controls | **Manual** | `docs/audio-real-device-checklist.md`, `docs/LAUNCH_CHECKLIST.md` |
| Read-aloud with screen off | **Manual** | Device + voice model; live read-aloud smoke (Chromium + WebKit) after footer-headphone fix |
| Expressive &gt; Natural (listening test) | **Manual** | `src/engines/emotion/` tests; Cast voices mode in `NarrationControls` |
| Voice Studio train + chapter | **Partial** | `src/features/voice-studio/e2e/`; full ONNX train optional (~55 MB helper) |
| Backup restores library, progress, notes | **Yes** | `workers/import/backup.ts` tests; `release-smoke-live-backup.spec.ts` + PNGs |
| 5,000-book library scrolls smoothly | **Yes (CI)** | `tests/perf/library.spec.ts` (`sizeForScroll: 5000`); Phase 1 **500 import** in `src/features/library/e2e/import.spec.ts` |
| Screen reader + contrast | **Partial** | `src/ui/styles/contrast.test.ts`; Lighthouse a11y ≥90; full SR walkthrough manual |

Live smoke matrix: `docs/screens/release-smoke-live/pagenest-42f.pages.dev/README.md`.
