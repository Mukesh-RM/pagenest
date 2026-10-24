# PageNest data layer (Phase 1: library, collections, covers, search)

Owner: Architect (`src/data`, `src/app`). Users of this page: the Library feature
(`src/features/library`) and the import worker (`src/workers/import`).
Source of truth for the schema is `docs/BLUEPRINT.md` section 13. **Phase 1 changes no schema**:
`SCHEMA_VERSION` stays 1, there is no Dexie upgrade, and nothing here needs a migration.

Rules that hold for everything below:

* Nobody outside `src/data` writes to the `books`, `tracks`, `chapters`, `collections` or
  `collectionBooks` tables, or to `books/`, `covers/` and `renders/` in OPFS. Go through the repositories.
* Every method takes and returns plain, structured-cloneable data (Blobs included), so it can be
  called through the data worker. Errors carry a stable `name` and `code` that survive the worker
  boundary (`RpcError.name`, `RpcError.code`).
* No network code. Nothing is sent anywhere.

## Where to call it from

```ts
// A screen (main thread): everything goes to the data worker.
const { data, covers } = useServices();
const result = await data.books.add({ ... });
const page = await data.library.query({ text: 'austen', sort: 'title' });

// The import worker: it opens its own connection to the same database and files and uses the
// repositories directly (no hop through the data worker, no copy of the book bytes).
import { BookRepository, CollectionRepository, getDb, createFileStore } from '@/data';
const books = new BookRepository(getDb(), createFileStore());
```

`DataClient` (what `useServices().data` is) now has three namespaces next to the older flat
methods: `data.books.*`, `data.collections.*`, `data.library.*`. The worker starts on the first
call. Where `Worker` does not exist, the same code runs in-process and the results are identical.

Two writers in two workers is safe: IndexedDB serialises transactions, and the search snapshot
and the screens refresh from Dexie's cross-connection change events (see "Staying up to date").

## BookRepository (`src/data/books.ts`)

`new BookRepository(db, files, now?)`; also `data.books`.

| Method | What it does |
| --- | --- |
| `add(NewBook)` → `AddBookResult` | Stores a book. Returns `{ status: 'added', book }` or `{ status: 'duplicate', existing }`. |
| `findByFingerprint(fp)` | Cheap duplicate check, so the importer can skip copying a big file. |
| `get(id)`, `getMany(ids)`, `count()` | Reads. `getMany` keeps the order given and skips unknown ids. |
| `getTracks(id)`, `getChapters(id)` | Audiobook files and chapters, in order. |
| `update(id, BookPatch)` → `BookRecord` | Metadata edit (title, author, narrator, series, language, favorite, finished, lastOpenedAt). `null` or `''` clears an optional field. |
| `markOpened(id)` | Stamps `lastOpenedAt`. |
| `setChapters(id, chapters)` | Replaces the chapter list. |
| `setCover(id, blob)`, `getCover(id)`, `removeCover(id)` | Cover image in `covers/<id>.img`. `getCover` is `undefined` when there is none or the file is gone. |
| `trash(ids)` → `{ token, bookIds }` | Removes the rows now, keeps the files, so **Undo** can bring everything back. |
| `restore(token)` → `{ restored, skipped }` | Undo. Puts back the book, tracks, chapters, progress, bookmarks, highlights, sessions, shelf links and renders. |
| `purge(token)` → bytes freed | Finishes the removal: deletes the files. Call when the Undo toast goes away. |
| `purgeAll()` | Finishes every pending removal (call before the page closes if you can). |
| `remove(ids)` → `{ token, bookIds, freedBytes }` | Trash plus purge in one step, for "delete without undo". |
| `cleanupOrphans()` → `{ removedBookIds, freedBytes }` | Deletes `books/<id>`, `covers/<id>.img`, `renders/<id>` that belong to no book. |

### What "added" guarantees

`add` validates first (title not empty, fingerprint not empty, a file or tracks as the kind needs),
then looks for a duplicate **before any bytes are written**, then writes the file, tracks and cover
to OPFS, then writes the book, tracks and chapters in **one** database transaction. If anything
fails, every file it wrote is deleted and the database is unchanged. Two imports of the same file
at once store one book and report the other as a duplicate (the unique `fingerprint` index
decides, and the loser's files are removed).

### Errors (`BookRepositoryError`, `.code`)

| Code | Meaning | What to show |
| --- | --- | --- |
| `invalid-input` | Not a book we can store; nothing written | The message is written for people. |
| `storage-full` | The device is out of space; nothing kept | "Not enough space on this device." |
| `write-failed` | A file or database write failed; nothing kept | Offer retry. |
| `not-found` | The book no longer exists | Refresh the list. |

### The delete-with-undo flow

```ts
const receipt = await data.books.trash(selectedIds);   // rows gone, files kept
showToast('3 books deleted', { undo: () => data.books.restore(receipt.token) });
// toast closed without undo:
await data.books.purge(receipt.token);
```

Trashed books are kept in memory of the repository that trashed them. If the app is closed before
`purge`, the files stay on disk with no book row; `cleanupOrphans()` at the next start deletes them.
So the worst case of a crash is a delete that cannot be undone, never a leaked file.
`restore` returns the id in `skipped` if the same file was added again in the meantime (its old
files are deleted, the new copy stays).

### Startup clean-up

Call `cleanupOrphans()` once at start, **before** imports begin. It protects books that are
trashed or being added by the same repository instance, but cannot know about an import running
in another worker, which would look like an orphan. So: run it first, and don't run it again while
an import is in flight.

## Covers and object URLs (`src/data/cover-url.ts`)

`CoverUrlCache` turns a stored cover into a `blob:` URL and cleans up. `useServices().covers`
is one, wired to `data.books.getCover`; screens use the hook:

```tsx
const url = useCoverUrl(book.id, book.coverRef !== undefined); // string | undefined
{url ? <img src={url} alt="" decoding="async" /> : <Placeholder />}
```

* One URL per cover, shared by everyone showing it, **ref-counted**: it is revoked only after the
  last user lets go and the cache needs room (default: keep the 120 most recently used idle covers).
  5,000 covers never mean 5,000 live URLs.
* Simultaneous requests for one cover load it once.
* After `data.books.setCover` or `removeCover`, call `covers.invalidate(bookId)`. Screens showing
  the old image keep it until they unmount; the next one gets the new image. A load that was in
  flight when you invalidated is discarded, never shown stale.
* `covers.dispose()` revokes everything (the app never needs it; tests do).
* Use the `acquire/release` API directly only outside React: `const lease = await covers.acquire(id); … lease?.release()`.
  Never keep `lease.url` after `release()`.

## CollectionRepository (`src/data/collections.ts`)

`new CollectionRepository(db)`; also `data.collections`. A collection is a shelf: ordered, named, can hold any books.

| Method | What it does |
| --- | --- |
| `list()` → shelves with `bookCount` | In shelf order; counts come from one pass over the link index. |
| `get(id)` | One shelf. |
| `create(name)` | Appends a shelf. Name: trimmed, inner spaces collapsed, 1–60 characters (`MAX_SHELF_NAME_LENGTH`), unique ignoring case and accents. |
| `rename(id, name)` | Same rules; changing only the case of the same shelf is allowed. |
| `remove(id)` → boolean | Deletes the shelf and its links. **Books stay in the library.** |
| `reorder(orderedIds)` | Drag-to-reorder shelves. Unlisted shelves keep their order after the listed ones; unknown ids are ignored. |
| `addBooks(id, bookIds)` → `{ added, alreadyThere, unknown }` | Appends to the shelf. Reports what happened to every id, so the UI can say "2 added, 1 was already there". |
| `removeBooks(id, bookIds)` → count | Takes books off the shelf and renumbers the rest. |
| `reorderBooks(id, orderedBookIds)` | Order inside a shelf. |
| `booksIn(id)`, `shelvesOf(bookId)` | Whole shelf contents (small shelves); shelves of one book (for the check marks in "Add to collection"). |

Errors (`CollectionError`, `.code`): `invalid-name`, `duplicate-name`, `not-found`.
Deleting a book (`BookRepository`) also drops its shelf links, and `restore` brings them back.
For a **paged, searchable** shelf view use `data.library.query({ collectionId })`, not `booksIn`.

## Search, filter, sort and paging (`src/data/library-query.ts`)

`data.library.query(query)` → `{ total, items }` and `data.library.count()`.

```ts
interface LibraryQuery {
  text?: string;                         // every word must match
  segment?: 'all' | 'books' | 'audio';   // the All / Books / Audio control
  status?: 'reading' | 'listening' | 'finished' | 'unfinished' | 'favorites';
  collectionId?: string;                 // only this shelf
  sort?: 'recent' | 'added' | 'title' | 'author' | 'relevance' | 'shelf';
  direction?: 'asc' | 'desc';
  offset?: number; limit?: number;       // default 60, at most 500
}
// items are BookRecord + { percent } (0–100, the furthest of reading/listening/read-aloud)
```

* **Matching** ignores case and accents (`cafe` finds `Café`), splits on anything that is not a
  letter or digit, and requires every typed word to match somewhere in title, author, narrator or
  series, as a word start or inside a word. Cyrillic `й` is folded to `и` on both sides (a side
  effect of removing accents); searching still works, it just doesn't tell them apart.
* **Relevance** (default when `text` is given): title starts with the word 6, a title word starts
  with it 5, an author word starts with it 4, inside a title 3, inside an author 2, narrator or
  series 1; the sum over the words decides, ties fall back to title order.
* **Default sort**: `relevance` with text, `shelf` inside a collection, otherwise `recent`
  (last opened first; never-opened books after, newest added first).
* **Status**: `reading`/`listening` mean there is progress in that mode and the book is not
  finished; `unfinished` is not finished; `favorites`; `finished`. Only `reading` and `listening`
  read the progress table (inside the worker, one row per book and mode); every other query reads
  progress for the returned page only.
* **Speed**: the service keeps a snapshot of the books in memory (about 300 bytes each, 1.5 MB for
  5,000), searches it directly, and builds progress only for the page returned. Measured with
  fake-indexeddb in the test suite on 20,000 books: a two-word search ≈ 12 ms and two sorted
  pages (including building the sort) ≈ 29 ms. These numbers are from Node, not from a phone;
  the test asserts only generous limits (400 ms and 1.5 s) so slow CI machines don't fail.
* No index was added to the schema. Title, author and narrator search over the snapshot does not
  need one, and the existing `title`/`author`/`addedAt`/`lastOpenedAt` indexes are untouched.

### Staying up to date

The snapshot is marked stale by any write to `books` (by this connection or any other, through
Dexie's `storagemutated` event) and rebuilt on the next query. Screens use two hooks from
`src/app/library-hooks.ts`:

* `useLibraryPage(query)` → `{ page, error }`. Reruns when the query (compared by value) or the
  library changes, keeps the previous page on screen while the next loads, drops answers that
  arrive late or out of order, and keeps the last good page if a request fails.
* `useLibraryRevision()` → a new object whenever books, shelves, shelf links or progress change
  (counts only, no data loaded). Use it to refresh anything else (for example the shelf list).

Known cost: any change to `books` makes the next query re-read the whole table once (on a real
device: tens of milliseconds at 5,000 books, **not measured in a real browser yet**). A bulk
import of hundreds of books can cause one re-read per refresh of the screen. If profiling shows a
problem, the fix is to patch the snapshot from Dexie table hooks instead of reloading (and for
screens to debounce `useLibraryRevision`); the public API does not change.

### Showing a grid of 5,000 books

Use `limit` and `offset` (or the Library's windowed list) rather than asking for everything:
`limit` is capped at 500. The placeholder `LibraryPage` in `src/app` shows the first 500 and says
"Showing 500 of N books." Do not call `db.books.toArray()` or `db.progress.toArray()` from a screen.

## Import jobs

The blueprint's schema (section 13) has **no import-job store**, so none was added. The importer can
report progress in memory (it already owns the job list) and call `add` per file, which is atomic,
so an interrupted import leaves either a whole book or nothing (plus orphan files that
`cleanupOrphans()` removes). If you need jobs to survive a restart (resume a half-done folder
import), that is a **schema change** (new Dexie version, e.g. an `importJobs` store) and needs
Casey's approval first; ask the Architect.

## What was changed in shared code

* `src/data/rpc.ts`: nested namespaces (`books.add`), `MethodPath<T>`, and refusal of method names
  every object has (`constructor`, `toString`, `__proto__`, …) or that do not resolve to a function.
* `src/data/data-service.ts` / `data-client.ts`: the three namespaces; `createDataService` returns a
  service with `dispose()` (not callable over RPC). The in-process fallback now loads the service
  on demand, so browsers with Workers never download a second copy.
* `src/data/data-service-methods.ts`: the method names, split out so the main thread knows them
  without importing the service.
* `src/app/services-context.ts`: `AppServices.covers`.

## Tests

`books.test.ts`, `collections.test.ts`, `cover-url.test.ts`, `library-index.test.ts`,
`library-query.test.ts` (including the 20,000-book run), nested RPC in `rpc.test.ts`, the full
path through a worker and through the in-process fallback in `data-client.test.ts` (including an
import-worker-style second connection), and `src/app/library-page.test.tsx` for the hooks and the page.
Shared helpers: `src/data/test-fixtures.ts` (a fresh database and in-memory file store per test).
