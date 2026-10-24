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

## Decision 8 (Oct 24, 2026, amended) Speech engine licensing (Auditor finding)
Amended after the Narration Piper spike and the Auditor's voice vetting (docs/MODEL_VETTING.md). There is no GPL relicense: PageNest stays MIT.
- Engine: Piper voices run through onnxruntime-web (MIT), with CMUdict (BSD-style licence, keep its copyright, conditions and disclaimer in the licenses screen) for grapheme-to-phoneme conversion.
- Not allowed in the bundle: eSpeak NG, piper-phonemize, piper1-gpl and kokoro-js (it depends on a phonemizer that embeds GPL eSpeak NG). Nothing GPL is added to main.
- Voice rule: every voice is checked per voice. en_US-lessac (Blizzard 2013, no commercial use) is NOT allowed. The earlier line "prefer libritts_r" was WRONG: en_US-libritts_r-medium is fine-tuned from lessac. Use en_US-libritts-high (trained from scratch, CC BY 4.0).
- Only voices registered OK in docs/MODEL_VETTING.md may be used. Every new voice goes through that vetting first. The models audit (scripts/audit-models.mjs, run by npm run audit) fails on unregistered or NOT OK voices and Hugging Face repos.
- Orpheus 3B is excluded (Llama 3.2 Community License). Kokoro-82M (Apache-2.0) and Chatterbox (MIT) may be used only as registered in MODEL_VETTING.md.

## Decision 9 (Oct 24, 2026) Dev-only licenses
MPL-2.0 dev-only tools (axe-core, @axe-core/playwright) are accepted. sharp's LGPL libvips binaries are accepted only as dev-only and never bundled; the audit script flags them if shipped.

## Decision 10 (Oct 24, 2026) Sample book and reader routes
The empty Library offers a "Try a sample book" card. It is one public-domain Project Gutenberg EPUB served from our own origin, not precached, and fetched only on tap. The Library bot provides it through SampleBookProvider (src/app/contracts/sample-book.ts); the card shows only when a provider is registered and available. Book routes are /read/:id and /listen/:id. Immersive routes hide the tab bar and rail; the mini-player persists on full routes (docs/ROUTE_CHROME.md).

## Decision 11 (Oct 24, 2026) Model policy
Composer was requested for all work. The CEO bot and the helper bots cannot select a model from inside the system, so the owner must set it on his side. This is flagged in every email until resolved.

## Decision 12 (Oct 24, 2026) Product excellence bar
The bar lives in the owner's instructions and is applied to every screen: taps respond in 100 ms, 60 fps, no layout shift, skeletons while loading, AA contrast in all 5 themes, Lighthouse 90+, usable at 200% text, works offline, no console errors, and proper laptop layouts. A Design Reviewer bot scores each screen 1-5; anything under 4 goes back to be redone. Approved screenshots are kept in docs/screens. A name-availability check runs before launch.

## Decision 13 (Oct 24, 2026) File type detection by content
Import detects the file type from content (magic bytes), never from the file name or extension. A book named `book.epub__1_` or with no extension still opens as EPUB, PDF, DOCX or another supported format.

## Decision 14 (Oct 24, 2026) Worker bundle budget and Phase 1 data layer scope
Casey approved the Architect's proposal on feature/data-phase1-prep. Bundle budgets: first-load JS stays at 120 kB gzip and first-load CSS at 12 kB. Web Worker chunks (`*.worker-*.js`) get their own budget of 55 kB gzip, because each worker carries its own copy of Dexie (about 30 kB); screens and other lazy chunks stay at 40 kB. The budgets live in `scripts/check-bundle.mjs` and `docs/PERFORMANCE.md`. Data layer: no tags field and no schema change (search covers title, author, narrator and series); no import-job store (the importer keeps job state in memory, and re-adding a folder after a restart skips books already imported by fingerprint); `cleanupOrphans()` runs exactly once at startup before any import and refuses with `cleanup-not-allowed` otherwise (docs/DATA_LAYER.md).

## Decision 15 (Oct 24, 2026) Lazy engine budgets and runtime cache for the Reader engines
Casey approved explicit per-chunk exceptions for the Reader's LAZY engines only; first-load JS stays at 120 kB gzip, first-load CSS at 12 kB, other lazy chunks at 40 kB and other workers at 55 kB. Limits (gzip): the pdf.js chunk (`engine-pdf-*`) 125 kB, `docx-core-*` 100 kB, `docx.worker-*` 100 kB, the EPUB engine (`engine-foliate-*`, foliate-js) 60 kB. They live in `scripts/check-bundle.mjs` (`ENGINE_CHUNK_BUDGETS_KB`) with tests in `src/app/bundle-budget.test.ts`, and the chunks get these names from `manualChunks` in `vite.config.ts`. These engine chunks and workers (including `pdf.worker*.mjs`) are NOT in the service worker precache (the precache file cap stays 1 MB). The service worker caches them at runtime, cache first, the first time a book of that format opens, so that format works offline from then on. To make the first book work offline too, the app fetches the sample book (and the EPUB engine once it ships) into that cache when the browser is idle shortly after the first Library render (`src/app/offline-warm.ts`; our own assets only, never offline or on save-data, no layout shift). The import worker and the import parsers stay precached (Decision 10 is unchanged: the sample is not precached). Details: docs/DEPLOY.md, docs/PERFORMANCE.md.
