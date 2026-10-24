# Book routes: `/read/:id` and `/listen/:id`

Every book opens on a real route. Today those routes show an honest summary screen (title,
author, saved percent and chapter, and a note that the reader or player arrives in a later
release). The engine owners replace that screen; nothing else has to change.

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

These routes sit outside the tab bar layout (full window). The screens are lazy chunks, so they cost nothing on first load.

## Replacing the screen

* E-books and documents: replace `src/app/pages/ReaderScreen.tsx`.
* Audiobooks: replace `src/app/pages/PlayerScreen.tsx`.

Keep the **default export** and the props:

```ts
interface BookScreenProps {
  book: BookRecord;                 // already loaded, never undefined
  position: ResumeInfo | undefined; // newest saved position; undefined if never opened
}
```

`position.locator` is the exact saved `Locator`: pass it to the engine to land on the same spot.
Save progress with `ProgressService.report` while the person reads or listens and `flush` on pause.
Keep the page free of buttons that do nothing. The placeholder's "Back to Library" is a real link; keep a way back.

## Sample book

The empty Library shows a "Try a sample book" card only when `AppServices.sampleBook` (a
`SampleBookProvider`, `src/app/contracts/sample-book.ts`) is registered **and** its `available()` is true.
The Library owner supplies:

1. the provider implementation (it fetches one small public-domain EPUB from our own origin **only when the person taps**,
   is not precached, and uses the normal import path);
2. the EPUB file itself (not in `src/app` or `src/data`);
3. its license entry in `docs/LICENSES.md`.

Until then the card does not appear.
