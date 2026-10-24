# Decisions

Every decision made during the build is recorded here and reported by email.

## Decision 1: Composer model requested for all work
The owner asked that the Composer model be used for all planning, coding, review and orchestration. Model selection cannot be forced from inside the bots (a bot cannot pick or switch the model it runs on), so this was flagged to the owner. If Composer is unavailable, work retries with backoff and the issue is mentioned in the next email; no silent model switch.

## Decision 2: Repo under Mukesh-RM, public, MIT
The repository is `Mukesh-RM/pagenest`: public, MIT licensed.

## Decision 3 (Oct 24, 2026) PWA colors and fonts
manifest theme_color and background_color are #FAFAF7 (light default); index.html also sets media-query theme-color meta tags for dark. Precache only Inter and the default reading font (Literata); other reading fonts cache on first use to keep the shell under 3 MB.

## Decision 4 (Oct 24, 2026) Headers and isolation
Cross-origin isolation stays OFF until a phase proves WebAssembly threads are required. connect-src in public/_headers is edited by Shell and PWA in Phase 4 once the exact model-hosting host and licenses are approved by the Auditor.

## Decision 5 (Oct 24, 2026) Team workflow
Architect owns the scaffold (feature/foundation-scaffold); other bots branch from main after it merges. Casey reviews and merges branches to main; bots never merge. npm scripts: lint, typecheck, test, build, test:e2e, dev, preview. QA e2e lives in tests/ with its own package; CI runs it explicitly.

## Decision 6 (Oct 24, 2026) New dependencies approved for Phase 0
vite-plugin-pwa, workbox-precaching, workbox-routing, workbox-window (MIT); sharp dev-only (Apache-2.0). Auditor verifies licenses in docs/LICENSES.md.

## Decision 7 (Oct 24, 2026) Model
Composer was requested for all work. Bots report they cannot select a model from inside their sessions, so this cannot be enforced from here; flagged to Mukeshh.
