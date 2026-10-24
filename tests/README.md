# PageNest tests

Owner: QA (`/tests` only). Everything here is self-contained: it has its own `package.json`, so it needs no change to the product's root files.

| What | Where | Tool |
|---|---|---|
| Smoke, PWA and offline tests | `e2e/*.spec.ts` | Playwright (Chromium desktop, Chromium phone, WebKit iPhone) |
| Accessibility and contrast tests | `e2e/a11y.spec.ts`, `e2e/support/axe.ts` | `@axe-core/playwright` |
| Contrast maths and blueprint palette | `unit/contrast.spec.ts`, `e2e/support/contrast.ts` | Playwright test runner (no browser) |
| Lighthouse gate (PWA and Accessibility >= 90) | `lighthouse/run.mjs` | Lighthouse 11.7.1 |
| Real-device checklist | `real-device/phase-0.md` | You, with a phone |
| Harness self-check app | `fixtures/reference-app/` | Not product code; see below |

## Run

```bash
npm ci                                     # repo root: the app and Playwright
cd tests
npm ci
npx playwright install chromium webkit     # first time only (on Linux: sudo npx playwright install-deps webkit)

npm test                                   # builds the real app from the repo root, runs `vite preview`, runs all projects
npm run test:unit                          # contrast maths only, needs no app
PAGENEST_BASE_URL=https://xyz.pages.dev/ npm test   # test a deployed or already running build instead
npm run test:fixture                       # run the suite against the reference fixture (harness self-check)

npm run test:perf                          # performance gates only (Chromium mobile, one worker: steadiest numbers)
npm run qa                                 # everything: Playwright, performance gates, Lighthouse; non-zero exit if ANY gate fails

npm run lighthouse                         # audits ../dist (run `npm run build` at the repo root first)
node lighthouse/run.mjs --url https://xyz.pages.dev/ --threshold 90
```

Environment variables: `PAGENEST_BASE_URL`, `PAGENEST_TARGET=fixture`, `PAGENEST_NO_SERVER=1` (start no server; `npm run test:unit` sets it), `PAGENEST_PORT` (default 4173), `PAGENEST_PHASE` (default 0; set to 1 to also enforce the Share Target manifest check), `PAGENEST_LAUNCH_BUDGET_MS` (default 1000, the offline launch budget from blueprint section 20), `CHROME_PATH` for Lighthouse.

Service workers only run in production builds, so the suite always uses `vite preview` on a built app, never `vite dev`.

### Who builds the app (never twice)

- **Locally** (`CI` unset): Playwright's `webServer` runs `npm run build` and then `vite preview`. You do not need to build first.
- **In CI** (`CI=true`): the workflow's own "Build" step already ran, so the `webServer` runs only `vite preview` and fails fast with a clear message if `dist/index.html` is missing.
- Override with `PAGENEST_SKIP_BUILD=1` (never build) or `PAGENEST_SKIP_BUILD=0` (always build).
- `webkit-iphone` is left out of the project list in CI unless `PAGENEST_WEBKIT=1`, because the CI job installs Chromium only.

## What the app must provide (selector contract)

The tests find things by ARIA role and visible name, never by CSS class. Phase 0 must therefore expose:

| Thing | Contract |
|---|---|
| Page title | contains `PageNest` |
| Navigation | one `<nav>` with an accessible name matching primary, main or tabs (bottom bar on phones, left rail on desktop) |
| Tabs | four links in the order Library, Collections, Stats, Settings; the current one has `aria-current="page"` |
| Screens | each tab shows an `<h1>` with the same text; the start URL shows Library |
| Theme | Settings has radios named Light, Sepia, Dark, Black; the choice sets `document.documentElement.dataset.theme` to `light`, `sepia`, `dark` or `black` and survives a reload; colours equal blueprint 5.2 |
| Bottom sheet | Settings has a button named "Install help"; it opens `role="dialog"` with `aria-modal="true"`, a Close button, focus inside the sheet, closes on Escape, and the back gesture closes it before changing screens |
| Touch targets | tab links are at least 44 by 44 px |
| PWA | linked manifest (standalone, `short_name` up to 12 chars, 192 and 512 PNG icons, a maskable icon, hex theme and background colours), `viewport-fit=cover`, `theme-color`, `apple-touch-icon`, standalone meta tags, `apple-mobile-web-app-status-bar-style`, `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` in the CSS, an active service worker that controls the page after the first load |
| Privacy | no request leaves the app's own origin |

If a name differs (for example the sheet trigger), change it in `e2e/support/app.ts`; every spec goes through that file.

## Reference fixture

`fixtures/reference-app` is a tiny static app that implements the contract above. Its only purpose is to prove the harness itself works (and to catch harness bugs) before and without the real app. It is not shipped and not a stand-in for product code. `fixtures/serve.mjs` is a dependency-free static server used by it and by `lighthouse/run.mjs`.

## Notes

- Lighthouse 12 removed the PWA category, so this repo pins Lighthouse 11.7.1 to honour blueprint section 19. Lighthouse 11 only checks installability, not offline support. The offline tests in `e2e/offline.spec.ts` are the real gate for the service worker.
- WebKit in Playwright is a proxy for Safari on iPhone. It does not replace `real-device/phase-0.md`.
- `npm audit` reports advisories (`cookie`, `zod`) in Lighthouse's own dev-only dependency tree. They are never part of the app and only run against local builds. `basic-ftp` is overridden to a fixed release.
- Licences: Playwright (Apache-2.0), Lighthouse (Apache-2.0), chrome-launcher (Apache-2.0), `@axe-core/playwright` (MPL-2.0). All are dev-only and none is bundled into the app.


## Performance gates ("no lag, ever")

All thresholds live in one file, `perf/budgets.ts`. Change a number there and nowhere else. A build that misses any gate fails QA: `npm run qa` (and each Playwright project, and `npm run lighthouse`) exits non-zero.

| Gate | Threshold | Where measured | Source |
|---|---|---|---|
| Lighthouse Performance score | 90 or more | `lighthouse/run.mjs` (mobile preset, simulated slow 4G) | brief; blueprint 3 and 16 |
| Lighthouse PWA and Accessibility scores | 90 or more each | `lighthouse/run.mjs` | blueprint 19 |
| First-load JavaScript | at most 200 KiB gzip (level 9), all scripts of a cold load, service worker blocked | `perf/js-budget.spec.ts` | QA choice (blueprint 16 allows 3 MB for the whole shell) |
| Tap response | p95 at most 100 ms, pointerdown to the first painted frame showing the change; 24 samples for tabs and themes, 10 for the sheet | `perf/interaction.spec.ts` | blueprint 3: every action within 100 ms |
| CPU for all perf tests | 4x slowdown (mid-range phone) | `throttleCpu` in `e2e/support/perf.ts` | blueprint 16 |
| Long tasks (PerformanceObserver) | none over 100 ms during load, tab use, library open and scroll | `perf/*.spec.ts` | QA choice |
| Scroll jank, 5,000 books | fling 3000 px/s for 2.5 s: p95 frame at most 33.4 ms, dropped frames (over 33.4 ms) at most 5 %, no frame over 100 ms | `perf/library.spec.ts` | blueprint 16: 60 fps scrolling |
| Library open, 1,000 books | at most 2000 ms from reload to the first card (wall clock, so it includes about 50 ms of test overhead) | `perf/library.spec.ts` | blueprint 16 (later launches under 1 s) plus QA headroom for 1,000 books |
| Library search, 1,000 books | at most 100 ms from the last keystroke to the narrowed list | `perf/library.spec.ts` | blueprint 3 |
| Library filter chip (Favorites), 1,000 books | at most 100 ms from tap to the filtered list | `perf/library.spec.ts` | blueprint 3 |

How the tests work, and what they cannot see:

- They run only in the `perf-chromium-mobile` project (Pixel 7 profile). `npm run test:perf` uses one worker, because parallel browsers would disturb each other's timings. Under `npm test` all projects run together, so timing gates can be noisier; use `npm run qa` for the official result.
- Seeding: `e2e/support/library.ts` writes books straight into IndexedDB database `pagenest`, store `books`, with the blueprint 13 `BookRecord` fields (`src/data/schema.ts`), then reloads. This stands in for the Library import path, which has not landed. When Library ships an import or seed API, swap `seedLibrary` and keep the tests.
- Search and filter tests find the field by role `searchbox` (or a textbox named Search) and the chip by name (`Favorites`, as a button, tab, radio or checkbox). They fail, not skip, while the Library screen lacks them. Owner: Library, with UI/UX.
- Emulated CPU throttling and headless Chromium are a proxy. The real-device checklist in `real-device/` still decides.
