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
# Or from the repo root: npm run playwright:install  (installs all browsers + OS deps)

npm test                                   # builds the real app from the repo root, runs `vite preview`, runs all projects
npm run test:unit                          # contrast maths only, needs no app
PAGENEST_BASE_URL=https://xyz.pages.dev/ npm test   # test a deployed or already running build instead
npm run test:fixture                       # run the suite against the reference fixture (harness self-check)

npm run test:excellence                    # product excellence gates per screen (themes, text size, viewports, CLS, motion, offline, console)
npm run test:perf                          # performance gates only (Chromium mobile, one worker: steadiest numbers)
npm run qa                                 # everything: Playwright, performance gates, Lighthouse; non-zero exit if ANY gate fails (always strict, ignores QA_GATES_ENFORCED)
npm run qa:stable                          # what CI blocks on: e2e projects (unit, Chromium desktop, Chromium phone) + Lighthouse
npm run qa:gates                           # what CI only reports until enforced: tests/excellence, then tests/perf (writes qa-reports/*.json)

npm run lighthouse                         # audits ../dist (run `npm run build` at the repo root first)
node lighthouse/run.mjs --url https://xyz.pages.dev/ --threshold 90
```

Environment variables for ports and deployed targets are listed in [docs/TESTING.md](../docs/TESTING.md). Common QA vars: `PAGENEST_BASE_URL`, `PAGENEST_TARGET=fixture`, `PAGENEST_NO_SERVER=1` (start no server; `npm run test:unit` sets it), `PAGENEST_PORT` or shared `PAGENEST_E2E_PORT`, `PAGENEST_PHASE` (default 0; set to 1 to also enforce the Share Target manifest check), `PAGENEST_LAUNCH_BUDGET_MS` (default 1000, the offline launch budget from blueprint section 20), `CHROME_PATH` for Lighthouse.

At the repo root, install browsers once with `npm run playwright:install` (same as `npx playwright install --with-deps`).

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


## Product excellence gates (per screen)

From Mukeshh's bar (`/workspace/pagenest-excellence-bar.txt`). Thresholds are in `perf/budgets.ts` under `excellence`; the tests are in `excellence/screens.spec.ts` (project `excellence-chromium-mobile`; layout shift needs Chromium) plus `e2e/` for the rest.

| Gate | Threshold | Test |
|---|---|---|
| Lighthouse per screen (Library, Collections, Stats, Settings) | Performance, Accessibility and PWA each 90 or more | `lighthouse/run.mjs` audits every screen in `excellence.screens`, after skipping onboarding in the Chrome profile |
| AA contrast, five themes | 4.5:1; Light, Sepia, Dark, Black, **Custom** (blueprint 5.2). The app must offer all five | `e2e/a11y.spec.ts` (four themes, every screen, axe), `excellence/` (five themes offered; Custom contrast) |
| 200% text size | every screen and the sheet: no horizontal overflow or clipped text, controls reachable and not covered, navigation in view, axe clean; and the scale must really take effect | `excellence/` using `expectTextScaleOk` (see "How the 200% gate works") |
| In-app text size reaches 200% | largest setting at least 2x the default | `excellence/` |
| Phone widths 360 and 430 px | no horizontal overflow; all targets 44 px or more (a radio's whole label counts); tab bar pinned to the bottom with content padding; CLS under 0.1 | `excellence/` |
| Laptop widths 1280x800 and 1440x900 | no horizontal overflow; rail beside the content, not overlapping; content at least 60 % of the width; rail stays in view while the page scrolls; CLS under 0.1 | `excellence/` |
| Layout shift | CLS under 0.1 after load and after walking through every tab, at all four viewports | `excellence/` |
| Reduced motion | `prefers-reduced-motion: reduce`: no transition or animation over 50 ms (computed styles and running animations), on every screen, a theme change and the sheet | `excellence/` |
| Offline | every screen reloads offline and shows its heading | `e2e/offline.spec.ts`, `excellence/` |
| Zero console problems | no console error or warning, page error, failed request or HTTP 4xx/5xx on every screen and theme | `excellence/`, `e2e/smoke.spec.ts` |
| Taps and scrolling | see "Performance gates" | `perf/` |

First launch shows onboarding. `launch()` in `e2e/support/app.ts` clicks Skip (which stores `onboardingDone`) so every test starts on the Library; only `e2e/onboarding.spec.ts` looks at onboarding itself (`launchFresh`).

Local runs share the machine with other tools, so pin a port when needed: `PAGENEST_E2E_PORT=4391 npm run qa` (or `PAGENEST_PORT=4391`; see [docs/TESTING.md](../docs/TESTING.md)). The real-app server is never reused (a stale one could serve an old build) and is started with `node .../vite.js preview`.

## CI (`.github/workflows/ci.yml`)

Two jobs, one build. The app is built once, in `verify`; `dist/` is uploaded as an artifact and reused by every later step and by `quality-gates` (nothing builds twice). With `CI=true` Playwright's webServer only runs `vite preview` on that `dist/`.

| Job | Blocks the build? | What it runs |
|---|---|---|
| `verify` | **Yes, always** | `npm run lint`, `tsc -b` (typecheck, in the build), root unit tests, `npm audit --omit=dev --audit-level=high`, `npm run audit` (licences, privacy, models, secrets), build **and the bundle size budget** (`scripts/check-bundle.mjs`), then `npm run qa:stable` in `tests/`: e2e on the real app (unit, Chromium desktop, Chromium phone) and Lighthouse >= 90 (performance, accessibility, PWA) on every screen |
| `quality-gates` | **No**, until `QA_GATES_ENFORCED=1` | `npm run qa:gates`: `tests/excellence` (themes, 200 % text, viewports, CLS, reduced motion, offline, console, Library edge cases) and `tests/perf` (JS size, tap p95, long tasks and jank, 1,000 and 5,000-book Library). Writes a table of failures to the run's Summary and uploads the HTML report, traces, screenshots, `qa-reports/*.json` and `tests/artifacts` (14 days) |

`quality-gates` has `continue-on-error: ${{ vars.QA_GATES_ENFORCED != '1' }}`. Until the repository variable is `1`, a failing gate shows as an annotation and a red step but the workflow stays green; the Summary says **REPORT-ONLY**. To enforce: Settings > Secrets and variables > Actions > Variables > New repository variable `QA_GATES_ENFORCED` = `1`. From then on a gate failure fails the build (the Summary says **ENFORCED**). No workflow edit is needed.

- Chromium only is installed. WebKit runs only when the repository variable `PAGENEST_WEBKIT` is `1` (then it is installed and `webkit-iphone` joins the e2e projects).
- Failed e2e runs upload `tests/playwright-report` and `tests/test-results`.
- `npm run qa` stays strict locally; `QA_GATES_ENFORCED` only affects the CI job.
- Gates never retry (`--retries=0`): a timing gate that passes on a second attempt is flaky, not green. Reports go to `tests/qa-reports/` because Playwright empties `test-results/` at the start of each run.
- Moving a gate into the blocking set: when a test in `excellence/` or `perf/` is stable and green, set `QA_GATES_ENFORCED=1` (all of them), or move the file to `e2e/` (that one only).

## Library edge cases (design review)

`sampleEdgeCases` in `e2e/support/library.ts` (no cover, very long title, a title with one unbreakable word, a two-line author, 0 %, 100 % and an audiobook at 50 %) is always part of `seedLibrary`. `e2e/library-edge-cases.spec.ts` renders the Library with them and writes a screenshot per project to `tests/artifacts/` (ignored by git, uploaded by CI; `docs/screens` is left alone). The test that fails on a real defect (a word that does not wrap is cut mid-letter) is `excellence/library-edge-cases.spec.ts`, so it reports without blocking.

## How the 200% text gate works, and the proof it has teeth

`applyTextScale(page, 2)` in `e2e/support/layout.ts` works whichever unit the app uses, and reads everything at runtime:

1. It scales the root font size (inline `font-size ... !important` on `<html>`), which is what an OS or browser text size does to rem/em text.
2. It walks the style sheets for custom properties whose name contains `font` or `text` and whose value is a px, rem or em length (PageNest: `--pn-font-size`, `--pn-text-xs` to `-xl`), measures each through a probe element before and after, and overrides only the ones that did **not** grow with the root (fixed px tokens) to before x scale. rem and em tokens follow the root by themselves.
3. It compares the rendered font size of every visible text element before and after (`unscaledText`).

`expectTextScaleOk` then fails the gate if the root or body did not actually grow (so a gate can never "pass" on an unscaled page), if more than 10 % of the text ignores the setting, or if anything overflows, is clipped or is unreachable.

**Harness self-check** (`e2e/text-scale-harness.spec.ts`, runs in the blocking e2e projects, needs no app): fixture pages in `fixtures/text-scale/pages.ts` in px, rem and mixed units. A sane layout must pass; each deliberately broken one must fail with the right message: fixed-width toolbar (`page scrolls horizontally`), fixed pixel height (`text clipped vertically`), fixed pixel width (`text clipped horizontally`), and text pinned in px (`body text did not scale`). The same broken pages are shown to be fine at 100 %, so the failure comes from the text size. A last test switches the real app's `--pn-text-*` tokens from px to rem at runtime and checks they are still scaled.

## Tap gates and a busy machine

The three tap gates (tab, theme, Install sheet) discard the first 4 taps (`tap.warmup`), take p95 over the next 30 (`tap.samples`, so one stray frame cannot fail the gate), and keep the 100 ms threshold. If p95 is over budget **and** the machine was busy (1-minute load average per core at or above `tap.busyLoadPerCore`, 0.5, before or after the run), the gate measures once more after a 3 s pause. A failure on a quiet machine, or a second failure, fails the gate. Both attempts and the load are in the failure message and in the attached `tap-*.txt`.

Evidence for "noise, not jank" came from `perf/tap-diagnostics.spec.ts` (opt-in, `TAP_DIAG=1`, not a gate): it splits each tap into input delay, the app's own handler time and presentation time from the Event Timing API, next to the machine load. On a quiet box the app's handler takes about 1 ms and the p95 is 59 to 63 ms; samples of 95 to 180 ms appear only while other processes load the box, and then input delay and presentation time grow, not the handler.

Mutation switch: `PAGENEST_QA_SLOW_TAP_MS=150` makes every pointerdown block the main thread for that long; the tap gates must fail with it (they do, p95 about 190 to 260 ms).

## Touch scroll, Lighthouse scenarios, sample book

**Touch-gesture scroll** (`touchScroll` in `e2e/support/perf.ts`, used by `perf/library.spec.ts`). It scrolls with real touch input (CDP `Input.dispatchTouchEvent`: touchStart, paced touchMove, touchEnd, as successive swipes) while sampling every animation frame. `Input.synthesizeScrollGesture` with source `touch` is NOT used: in headless Chromium it returns normally and the page stays at scrollTop 0, which is how an earlier harness measured jank on a page that never moved. `touchScroll` fails loudly (`the touch gesture did not scroll the page`) unless the page really moved by at least 40 % of what the swipes asked for. `e2e/touch-scroll-harness.spec.ts` proves it: it scrolls a tall page, and throws on a `touch-action:none` page and on a page with nothing to scroll.

**Lighthouse scenarios** (`lighthouse/run.mjs`, thresholds in `perf/budgets.ts` `lighthouse`). Besides every screen, it audits (a) the Library with 250+ books seeded into IndexedDB and (b) a first launch in a fresh Chrome profile with onboarding on screen (checked before auditing). Every audited page needs Performance, Accessibility and PWA >= 90 **and** CLS < 0.1. `--scenarios none` runs the screens only (that is what the blocking `qa:stable` uses); `--scenarios only` runs just the two scenarios (part of `qa:gates`, so report-only in CI until `QA_GATES_ENFORCED=1`). The audit's static server (`fixtures/serve.mjs`) compresses text like a real host; without it the first launch scored 76 on a text-compression defect production does not have.

**Sample book gate** (`excellence/sample-book.spec.ts`): first launch, Skip, empty Library, "Try a sample book", add it, open it; the reader must show real prose. `e2e/support/reader.ts` measures visible prose (paragraphs of 80+ characters outside buttons, navigation, headers and dialogs) and fails on placeholder copy ("arrives in a later release", "coming soon", "lorem ipsum", ...), fewer than 3 paragraphs, fewer than 800 characters, fewer than 120 words, or text that is not mostly plain words. `e2e/sample-book-harness.spec.ts` proves the detector accepts prose and rejects each placeholder shape. Owners: Library (the card and the sample provider), Reader (the screen).

## Layout-shift (CLS) gates, resume card, label in name

- `excellence/layout-shift.spec.ts`: CLS < `BUDGETS.lighthouse.maxCls` (0.1) at 4x CPU slowdown for (a) a first launch with onboarding visible, measured over load plus the first interactions (Next, Next, Done, every tab), (b) the Library with the "Welcome back" resume card, (c) the same with 250 books and a first scroll. A failure lists the elements that moved (tag, class, text, box before and after, from PerformanceObserver `layout-shift` sources): shifts in the Library list or resume card are Library's (resume card markup: UI/UX), shifts of the shell, tab bar or onboarding are UI/UX's.
- The resume card is real, not mocked: `e2e/support/resume.ts` `seedResumeBook` writes one book to the IndexedDB `books` store and one row to `progress` (`bookId, mode:'read', locator, percent:42, updatedAt:now`), exactly what `loadResume` in `src/data/resume.ts` picks (newest row, book not finished, 0 < percent < 100). `expectResumeCardRendered` fails loudly if the card is not on screen, so a CLS is never measured on the wrong page.
- `e2e/cls-harness.spec.ts` (blocking e2e): a page whose banner arrives late must measure > 0.1 and name the element that moved; a stable page must measure ~0. Chrome ignores shifts before the first paint, so the fixture shifts after 1.5 s.
- Lighthouse adds the scenario "Library with 250+ books and the resume card" (Performance >= 90, CLS < 0.1) and prints, for every audit, the Best practices score and the elements behind each failing best-practice audit (informational; `label-content-name-mismatch` is printed with selector and snippet).
- `excellence/label-in-name.spec.ts`: axe `label-content-name-mismatch` (WCAG 2.5.3, experimental rule enabled explicitly) on the Library with the resume card, Collections, Stats and Settings. Failure shows each control's markup and its visible text. (Mistake to avoid: an `aria-label` that rewrites the visible text, e.g. "Unfinished. Books you started" for the visible "Unfinished Books you started", or a card whose cover repeats the title as real text.)
