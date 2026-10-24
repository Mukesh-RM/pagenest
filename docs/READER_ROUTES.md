# Book routes: `/read/:id` and `/listen/:id`

Every book opens on a real route. On `feature/integrate-2` those routes show an honest summary screen (title,
author, saved percent and chapter, and a note that the reader or player arrives in a later
release) until the Reader and Audio screens are merged. The engine owners replace that screen; nothing else has to change.

## Paths

`src/app/route-paths.ts` is the only place paths are built. Do not write `'/read/' + id` anywhere else.

| Helper | Result |
| --- | --- |
| `readPath(id)` | `/read/<id>`: e-books, PDFs, documents |
| `listenPath(id)` | `/listen/<id>`: audiobooks |
| `pathForBook({ id, kind })` | `listenPath` when `kind === 'audio'`, otherwise `readPath` |
| `READ_ROUTE`, `LISTEN_ROUTE` | the `<Route path>` patterns |

The Welcome back card and the sample book card both navigate with `pathForBook`.

## What the router does for you

`src/app/pages/BookRoute.tsx` handles everything around the screen:

1. loads the book from Dexie by id (`books.get`) and its newest saved position
   (`loadBookPosition`, which uses `ProgressService.getLatest` so a position not yet written is included);
2. shows a "We can't find that book" state, with a button to the Library, for an unknown id;
3. redirects a book opened on the wrong route to the right one (an audiobook on `/read/:id` goes to `/listen/:id`, and the reverse);
4. renders the screen below inside `Suspense` with a skeleton, so the page does not jump.

These routes are **immersive** (no tab bar, rail or mini-player; the screen has the whole window). The default is set in the route table and a screen can override it with `useRouteChrome`; see `docs/ROUTE_CHROME.md`. The frame adds no padding on immersive routes, so a replacement screen owns its margins and safe areas. The screens are lazy chunks, so they cost nothing on first load.

## Hooks for the Reader and Audio screens

There are exactly two places where a screen plugs in, both in `src/app/pages/BookRoute.tsx`. Nothing else in `src/app` has to change.

| Route | Lazy mount in `BookRoute.tsx` | Props | Who owns the screen |
| --- | --- | --- | --- |
| `/read/:id` | `const ReaderScreen = lazy(() => import('./ReaderScreen'))` | `{ book, position }` (`BookScreenProps`) | Reader bot: `BookRoute.tsx` lazy-imports `@/features/reader/live/LiveReader` (the placeholder `pages/ReaderScreen.tsx` is no longer mounted) |
| `/listen/:id` | `const PlayerScreen = lazy(() => import('./PlayerScreen'))` | `{ book, position }` (`BookScreenProps`) | Audio bot; today a summary placeholder in `src/app/pages/PlayerScreen.tsx` |

Both are **default exports** in lazy chunks, so they cost nothing on first load (`perf-rules.test.ts` fails if either is imported
from first-paint code). A replacement either re-exports the real screen from `src/features/...` or changes the `lazy(...)` line to point at it.
If the real screen only needs the book id (the Reader's `ReaderScreen` loads the book, saved position and its engine itself), mount it as
`<ReaderScreen key={book.id} bookId={book.id} />`; `BookRoute` has already done the not-found and wrong-route handling above, so the screen never sees a missing book.

```ts
interface BookScreenProps {
  book: BookRecord;                 // already loaded, never undefined
  position: ResumeInfo | undefined; // newest saved position; undefined if never opened
}
```

`position.locator` is the exact saved `Locator`: pass it to the engine to land on the same spot.
Save progress with `ProgressService.report` while the person reads or listens and `flush` on pause.
`ImportResult` has `kind` (routing: use `pathForBook`) and `format` (engine choice: the real format detected from the file's content).
Keep the page free of buttons that do nothing, and keep a way back (the placeholders' "Back to library" is a real control).

### How an engine is picked for a book: by format, inside the Reader

`BookRoute` does **not** choose an engine. It routes by `kind` (`audio` goes to `/listen`, everything else to `/read`). The reader screen then
picks the engine from the stored `books.format` (written by the Library from the file's bytes, never from the file name):

* `src/features/reader/engines.ts` builds the default `ReaderRegistry` (`src/features/reader/core/registry.ts`). Each entry is
  `{ id, formats, load }` and `load` is a dynamic `import()`, so pdf.js, foliate-js and mammoth are chunks fetched the first time a
  book of that format opens.
* **Registration point for a new format:** add one `.register({ id, formats, load })` entry in `engines.ts` (and list the format in the engine's `formats.ts`). The screen and the route do not change.
* Engine types are in `src/engines/reader/types.ts`; the engines live in `src/engines/pdf` and `src/engines/epub`.

### How the player gets its `AudioController`

The controller is a singleton owned by the Audio bot (`src/features/player/PlayerProvider.tsx`, `createAudioController`), not by `src/app`:

1. `<PlayerProvider>` wraps the app (inside `ServicesProvider`, because the controller needs `services.progress`). It owns the single `HTMLAudioElement`.
2. The full screen, `AudiobookPlayerScreen` (default export, props `{ book, position }`), reads it with `getAudioController()` or `useAudioController()`.
   `PlayerScreen.tsx` is replaced by `export { default } from '@/features/player/AudiobookPlayerScreen'`.
3. The mini-player is the same controller's slot: `AppServices.miniPlayerSlot = miniPlayerSlot` from `@/features/player` (see `docs/ROUTE_CHROME.md`).

Playback state must never live in a screen or the mini-player (both unmount); it lives in the controller, so audio keeps playing across routes.
`src/app` does not create an `AudioController` itself and has no engine for the design system's `AudioPlayerScreen` `controller` prop, so that prop
is wired only when the Audio bot's branch is merged. `ReaderScreen`'s `minutesLeftInChapter` (the design system's reader) is not used any more once the Reader bot's own screen replaces the placeholder; it computes it from its engine.

### Merge status (see the report for the current commits)

* The Reader bot's work (`feature/reader`) is merged with this swap on `feature/integrate-2-reader`; it goes into `feature/integrate-2` when its bundle budgets and the motion rule pass.
* The Audio bot's work (`feature/audio`) has no `src/app` changes yet; the three steps above are the whole wiring.

## Sample book

The empty Library shows a "Try a sample book" card only when `AppServices.sampleBook` (a
`SampleBookProvider`, `src/app/contracts/sample-book.ts`) is registered **and** its `available()` is true.
The Library owner supplies:

1. the provider implementation (it fetches one small public-domain EPUB from our own origin **only when the person taps**,
   is not precached, and uses the normal import path);
2. the EPUB file itself (not in `src/app` or `src/data`);
3. its license entry in `docs/LICENSES.md`.

Until then the card does not appear.
