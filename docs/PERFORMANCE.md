# PageNest performance rules

Mukeshh's rule: **nobody should ever feel lag.** This page lists how `src/app` and `src/data`
keep to it, the numbers we hold ourselves to, and the checks that fail when someone breaks them.
Other folders (`src/ui`, `src/engines`, `src/sw`) are owned by other roles; the risks listed at the
end are for their owners to decide.

## What the main thread may do

The main thread draws, handles taps and runs React. It does **not** do heavy work.

| Work | Where it runs |
| --- | --- |
| Reading and writing book files in OPFS (including sync access handles) | Web Worker (`src/data/data.worker.ts`) |
| Hashing a file for duplicate detection (`computeFingerprint`) | Web Worker |
| Adding up reading sessions for the Stats screen (`computeStats`) | Web Worker |
| Adding a book (copying its file and cover into OPFS, then one database transaction), deleting, undo, clean-up | Web Worker (`data.books.*`) or the import worker |
| Searching, filtering, sorting and paging the library (`data.library.query`) | Web Worker; the screen receives one page |
| Small settings reads and writes, live queries that show one screen of rows | Main thread (Dexie, a few rows) |

How the worker is used:

* `src/data/rpc.ts` is a tiny typed request/response layer over `postMessage` (no dependencies).
* `src/data/data-service.ts` is the work itself, as a plain object (`DataService`).
* `src/data/data.worker.ts` serves that object inside a worker.
* `src/data/data-client.ts` gives the main thread the same methods as Promises. The worker is
  created on the **first call**, never at startup. Where `Worker` does not exist (old WebViews,
  tests) or cannot start, the same service runs in-process, with the same results.
* Screens get it from `useServices().data`. For code that wants a plain `FileStore`, use
  `createWorkerFileStore(data, await data.fileStoreInfo())`.
* Arguments and results must be structured-cloneable (`Blob`, `File`, `ArrayBuffer`, plain objects).
  Pass a `Blob` or `File` rather than reading it into a string first.

## Loading

* Each tab (Library, Collections, Stats, Settings) and onboarding is its own chunk
  (`React.lazy`, `src/app/screens.ts`). The first paint only needs the shell, router, theme and settings.
* The Library chunk starts downloading at once; the other tabs are fetched when the browser is
  idle (`requestIdleCallback`), so switching tabs does not wait.
* The reader and player screens are fetched when idle too (they are small and open on a tap).
* Overlays are not part of first paint: the PWA prompts (`LazyPwaPrompts`) mount when idle, and the
  book detail sheet (`LazyBookDetailHost`) is prefetched when idle after the grid is up. Both render
  nothing in the page flow, so nothing shifts. The file-store code (`src/data/opfs.ts`) is only
  loaded in the no-Worker fallback. `src/app/perf-rules.test.ts` fails if any of these becomes a
  static import again. Initial JS went from 114.49 to 109.49 kB gzip (budget stays 120).
* While a chunk loads, a fallback with the same header height and a skeleton block is shown, so
  the page does not jump (no layout shift).
* The dev-only `/ui-kit` demo is behind `import.meta.env.DEV` and is not in the production build.
* No heavy dependencies. Runtime dependencies: react, react-dom, react-router-dom, zustand, dexie,
  dexie-react-hooks. `lucide-react` was removed (icons are vendored in `src/ui`).

## Rendering

* Zustand: always select the slice you need (`useSettings((s) => s.fontSizePx)`). Never call a
  store hook with no selector. A test enforces this.
* List items are `memo`'d and take plain values (a string, a number), not database rows, which are
  new objects on every query run. A progress write re-renders one tile, not the whole grid.
* Contexts are split by purpose (services, theme) and their values are memoized. Callbacks passed
  to the design system are `useCallback`.
* Live queries are narrow: Collections reads shelf counts in one keys-only pass; Stats reads only
  the last 7 days through the `startedAt` index. The Library never reads whole tables on the main
  thread: it asks the data worker for one page (`useLibraryPage`, `docs/DATA_LAYER.md`) and only
  counts rows to know when to ask again (`useLibraryRevision`). Covers are `blob:` URLs shared and
  reference-counted by `CoverUrlCache`, so 5,000 covers never mean 5,000 live URLs.
* Progress writes stay throttled (5 s, see `docs/PROGRESS_SERVICE.md`). The text size slider
  changes the screen on every tick but writes to IndexedDB once, 250 ms after it rests, and
  immediately when the page is hidden or onboarding ends.
* Animations use `transform` and `opacity` only, and are off with `prefers-reduced-motion`
  (`src/index.css`).

## Resume and first launch (owner's quality bar)

* **Perfect resume.** Positions are saved as a `Locator` through `ProgressService` (throttled, and
  flushed when the page is hidden). `loadResume` (`src/data/resume.ts`) reads the newest saved
  position of a book that still exists and is not finished, plus that book's chapter, and returns
  the exact `locator` for a reader or player to restore.
* **"Welcome back, chapter 7" card** on the Library screen (`ResumeCard`). It is hidden when
  there is nothing to resume. The chapter is the last chapter that starts at or before the saved
  position (text, PDF page, audio track or M4B seconds); with no chapter info it says just
  "Welcome back". Until a reader route exists it is **information only** (no button or link);
  pass `href` to `ResumeCard` once a real route exists and it becomes a link.
* **No layout shift.** The card has a fixed 88 px height, and its skeleton is the same size. The last
  visit's "had a card" flag is kept in localStorage (`resume-hint.ts`), so the space is reserved from the
  first frame; the Library renders books and card together once both are read.
* **First launch to first book.** Onboarding is three cards, every one has **Skip**, nothing is
  required, and the defaults (match my phone, 16 px text) need no setup. Getting a book in depends on
  the import feature (Library), which is not built yet.

## Budgets

`npm run build` ends with `scripts/check-bundle.mjs` and fails when a budget is exceeded.
`npm run check:bundle` runs the check on an existing `dist/`. Sizes are gzip level 9, 1 kB = 1000 bytes.

| What | Budget | Measured (this branch) |
| --- | --- | --- |
| First-load JS (index.html's module script + modulepreloads) | **120 kB** | 105.8 kB |
| First-load CSS | **12 kB** | 7.2 kB |
| Any single lazy chunk (tab, onboarding, in-process data service) | **40 kB** | largest: in-process data service 5.6 kB; biggest tab 3.5 kB |
| A Web Worker chunk (`*.worker-*.js`; carries its own Dexie) | **55 kB** (every worker, the Library's import worker included) | data worker 40.6 kB; import worker 52.4 kB; audio tag worker 36.2 kB |

Why 120 kB and not 150 kB: react-dom, the router and Dexie are about 100 kB of the first load and
are not going away, so 120 kB leaves room for roughly one small feature before someone has to
justify it. If a feature genuinely needs more, raise the number in `scripts/check-bundle.mjs`
**and** this table in the same commit, and say why in the commit message.

The worker budget was added with the Phase 1 data layer: the data worker went from 35.0 to 39.9 kB
gzip (books, collections and the search service), which left 0.1 kB under the old 40 kB cap that was
meant for screens. About 30 kB of a worker is Dexie itself, which every worker pays once. The
import worker (Library) will be a second worker with the same cost, so 55 kB is for the worker
type, not a free pass: keep adding code to the worker only when it must run off the main thread.
The in-process fallback loads the data service on demand (a separate 5.6 kB chunk), so
browsers that have Workers never download it and the first-load JS did not grow by it.

Fonts (two Inter variable files, 133 kB) are not JavaScript and do not count here, but they cost
bytes on a first visit; see risks below.

The script itself is tested in `src/app/bundle-budget.test.ts` against fake `dist` folders. The
source rules above are tested in `src/app/perf-rules.test.ts`.

## Before and after

| | Before (design system merged, all pages static) | After |
| --- | --- | --- |
| First-load JS, gzip | 106.7 kB (322.7 kB raw) | 105.8 kB (with route chrome, resume card and library hooks) |
| First-load CSS, gzip | 7.03 kB | 7.06 kB |
| JS needed for the first screen | everything, including Settings, Stats, Collections | shell + Library only |
| Data worker | n/a | 39.9 kB gzip, loads on first use |

The first-load total moved little because Dexie, React and the router dominate it; the win is that
every screen is now separate and heavy work is off the main thread, with a hard cap that cannot
drift up unnoticed.

## Risks to watch (for the owners named)

These were noticed, not changed, because the files belong to other roles.

**`src/ui` (UI/UX)**

* `BottomSheet` calls `setState` (`setDragY`) on every `pointermove` while dragging. Prefer writing
  `transform` straight to the element in a `requestAnimationFrame` and committing React state on release.
* `BottomSheet` reads `getComputedStyle` for durations and a `ResizeObserver` publishes `offsetHeight`;
  both can force layout. Cache the duration, and observe without reading back layout in the callback.
* The skeleton shimmer animates `background-position` forever, which repaints every frame for each
  skeleton on screen. Animate a `transform` on a pseudo-element, or pause it off-screen and for
  `prefers-reduced-motion`.
* `will-change: transform` on sheets that are not moving keeps a compositor layer alive.
* `AppShell` renders both the rail and the tab bar and hides one with CSS; the hidden one still
  costs React work and accessibility-tree nodes.
* `BottomSheet` calls `history.back()` when its owner unmounts. A screen that navigates while a
  sheet is open (for example a button inside a sheet) can undo its own navigation. Close the sheet first, then navigate.
* Text size tokens are in px; the app scales `--pn-text-*` from the user's text size setting.
  Keep those token names stable, or move them to rem.
* Fonts: two Inter variable files (133 kB). Consider `font-display: swap` with a system fallback
  and keeping only the weights used.

**`src/sw` / PWA (QA, UI)**

* The service worker must precache **all** lazy chunks and `data.worker-*.js`, or Stats and file
  work fail offline.
* A new data worker URL appears with each build (hashed name); the precache manifest handles that,
  a hand-written list will not.

**Library, readers, audio**

* Done in `src/data` and the placeholder `LibraryPage`: paged, searchable queries in the worker and no
  whole-table reads on the main thread. The **real** Library screen still needs a windowed list
  (virtualisation) for thousands of books; the data layer pages with `limit`/`offset` and caps a page
  at 500. The placeholder shows the first 500 and says "Showing 500 of N books."
* Importing, cover extraction and EPUB parsing must go through a worker (`src/workers/import`) and
  never block on `File.arrayBuffer()` of a whole book on the main thread. Use `BookRepository.add`
  for the writes; it takes `Blob`s and never reads them into memory itself.
* Cover images should be decoded at thumbnail size when they are extracted (a 3000 px cover as a grid
  tile costs memory even with `decoding="async"`). That is the importer's job.
* Audio and TTS engines should run decoding and model work off the main thread too.

**QA**

* E2E tests that expect the Library on first load now meet onboarding first. Click **Skip** or seed
  the `onboardingDone` setting.
* Add a Lighthouse or trace-based interaction check once the library has real data.

## Status of each item in `src/app` and `src/data` (checked on `feature/data-phase1-prep`)

| Item | Status | Evidence |
| --- | --- | --- |
| Files, hashing, stats off the main thread | Fixed | `data-client.test.ts` runs them through a real `MessageChannel` |
| Books, search, covers off the main thread | Fixed (new) | `data-client.test.ts` "library APIs through the client" |
| Tabs lazy, no static page import | Fixed | `perf-rules.test.ts` |
| Idle prefetch of tabs | Fixed, test added | `idle-preload.test.ts` (waits for idle, 3 s timeout, 1.5 s timer fallback, cancel) |
| Zustand selectors only | Fixed | `perf-rules.test.ts` |
| Memoized book tile, plain values | Fixed, test added | `library-page.test.tsx`: same values render 0 times, a progress write renders 1 tile |
| Library read the whole `books` and `progress` tables on the main thread | **Was open, now fixed** | `LibraryPage` uses `useLibraryPage`; test spies `progress.toArray` |
| Library list unbounded | Fixed for the placeholder (500 cap + honest count); real windowed list is the Library's | `library-page.test.tsx` "Showing 500 of 520" |
| Animations only `transform`/`opacity`; reduced motion | Fixed, test added | `perf-rules.test.ts` ("motion preferences") |
| Text size writes once; progress writes throttled to 5 s | Fixed | `settings-store.test.ts`, `progress-service.test.ts` |
| Services context memoized | Fixed | `ServicesProvider` `useMemo` |
| No layout shift on tab load | Fixed in code; **no automatic test** (needs a real browser layout) | Same-height fallback in `ScreenFallback`; QA to add a trace check |
| First-load budget | Fixed, enforced | `bundle-budget.test.ts`, `npm run build` |
| Whole-table `progress` read for the `reading`/`listening` filters | Open (small): rows are one per book and mode, read in the worker only when that chip is used | `DATA_LAYER.md` |
| Snapshot re-read after any `books` change | **Was open, now fixed** (measured 41 ms median at 5,000 books in Chrome, now 0.5–2 ms) | `docs/DATA_LAYER.md` "Cost of a change"; `library-query-patch.test.ts` counts rows read; `scripts/bench-library.mjs` |

Everything under "Risks to watch" for `src/ui`, `src/sw`, the Library feature and QA is for those
owners and was not touched.

## integrate-2: first launch, Library layout shift, startup, taps

Measured on the production build (`vite preview`), Pixel 7 profile, 4x CPU throttle, Lighthouse 11.7.1 mobile (simulated slow 4G).

| | Before | After |
| --- | --- | --- |
| First launch, Lighthouse Performance | 75-77 | 93-95 (3 runs; FCP 1.7-1.9 s, LCP 2.9-3.1 s, TBT 30-70 ms, CLS 0) |
| Library after onboarding, 300 books and a resume card, CLS | 0.20 | 0 (Performance 94-96) |
| Initial JS / CSS, gzip | 116.05 / 9.3 kB | 116.85 / 9.32 kB (budget 120 / 12) |
| Entry evaluation at 4x CPU (long tasks over 50 ms, first launch, 6 runs) | 5 of 6 runs, 57-72 ms | 2 of 6 runs, 54-58 ms (react-dom, dexie and the router are now chunks of their own) |
| Tab switch p95 / open-book sheet p95 at 4x | 91-211 ms (shared box, noisy) / 77-148 ms | 79-96 ms / 78-80 ms in the quiet runs |

What changed, in short: a static boot screen in `index.html` (the first paint no longer waits for JavaScript), the first screen's chunk is
fetched by a device hint (`pn.onboarded` in localStorage; the database stays the source of truth), the other tabs are fetched 2 s after
the first paint, the Library is drawn only once the resume query has answered (the card is already in the header slot, so nothing moves),
a position at 0 % is never offered, and the vendor chunks are split. Lighthouse is limited by the ~117 kB gzip entry (react-dom, router,
Dexie); going lower needs a smaller entry, not more deferral.
