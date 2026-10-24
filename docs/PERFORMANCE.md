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
  the last 7 days through the `startedAt` index.
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
| First-load JS (index.html's module script + modulepreloads) | **120 kB** | 103.4 kB |
| First-load CSS | **12 kB** | 7.1 kB |
| Any single lazy chunk (tab, onboarding, data worker) | **40 kB** | largest: data worker 35.0 kB; biggest tab 3.5 kB |

Why 120 kB and not 150 kB: react-dom, the router and Dexie are about 100 kB of the first load and
are not going away, so 120 kB leaves room for roughly one small feature before someone has to
justify it. If a feature genuinely needs more, raise the number in `scripts/check-bundle.mjs`
**and** this table in the same commit, and say why in the commit message.

Fonts (two Inter variable files, 133 kB) are not JavaScript and do not count here, but they cost
bytes on a first visit; see risks below.

The script itself is tested in `src/app/bundle-budget.test.ts` against fake `dist` folders. The
source rules above are tested in `src/app/perf-rules.test.ts`.

## Before and after

| | Before (design system merged, all pages static) | After |
| --- | --- | --- |
| First-load JS, gzip | 106.7 kB (322.7 kB raw) | 103.4 kB (312.7 kB raw) |
| First-load CSS, gzip | 7.03 kB | 7.06 kB |
| JS needed for the first screen | everything, including Settings, Stats, Collections | shell + Library only |
| Data worker | n/a | 35.0 kB gzip, loads on first use |

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

**Library, readers, audio (not built yet)**

* The Library lists every book from `books.toArray()` and has no virtualization. Past a few
  hundred books, use a windowed list (and a paged or indexed query).
* `useLiveQuery` on the whole `progress` table reruns on every progress write. Fine for a few
  hundred rows; for more, query progress per visible book.
* Importing, cover extraction and EPUB parsing must go through the worker (`DataService`) and
  never block on `File.arrayBuffer()` of a whole book on the main thread.
* Audio and TTS engines should run decoding and model work off the main thread too.

**QA**

* E2E tests that expect the Library on first load now meet onboarding first. Click **Skip** or seed
  the `onboardingDone` setting.
* Add a Lighthouse or trace-based interaction check once the library has real data.
