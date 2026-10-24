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
| `cleanup-not-allowed` | `cleanupOrphans()` was refused (see "Startup clean-up"); nothing deleted | Nothing. Log it and carry on. |

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

**`cleanupOrphans()` runs exactly once, at startup, before any import begins.** (Casey's decision.)
A half-written import looks exactly like a leftover, so the repository refuses instead of guessing.
It throws `BookRepositoryError` with code `cleanup-not-allowed` (and deletes nothing) when:

* it already ran on this repository, or a first call is still running;
* this repository has already started adding a book (an `add` that passed validation, even if it
  ended as a duplicate; an `add` rejected as `invalid-input` does not count);
* another worker or tab is adding a book right now. Every `add` holds a shared Web Lock
  (`pagenest:book-files`) and the clean-up takes it exclusively, so this works across the data worker
  and the import worker. Where Web Locks do not exist the guard covers one repository only, so
  run the clean-up before the import worker is started.

If the clean-up fails halfway (a file error) and nothing had been added, it may be called again.
An `add` that arrives while the clean-up is running waits for it to finish, so a new book's files
can never be taken. The error is caught and ignored by callers: it only means "not needed or not
safe now", and leftovers are removed at the next start.

```ts
// App start, before the import worker or the first add:
await data.books.cleanupOrphans().catch(() => undefined);
```

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
* **Fields searched**: title, author, narrator and series. There is **no tags field**: `BookRecord`
  is unchanged and the schema is unchanged (Casey's decision). Adding tags later would be a schema
  change and needs his approval first.
* **Speed**: the service keeps a snapshot of the books in memory (about 300 bytes each, 1.5 MB for
  5,000), searches it directly, and builds progress only for the page returned. Measured with
  fake-indexeddb in the test suite on 20,000 books: a two-word search ≈ 12 ms and two sorted
  pages (including building the sort) ≈ 29 ms. These numbers are from Node, not from a phone;
  the test asserts only generous limits (400 ms and 1.5 s) so slow CI machines don't fail.
* No index was added to the schema. Title, author and narrator search over the snapshot does not
  need one, and the existing `title`/`author`/`addedAt`/`lastOpenedAt` indexes are untouched.

### Staying up to date

Any write to `books` (by this connection or any other, through Dexie's `storagemutated` event)
is noticed, and the snapshot is patched with just the written books before the next query
answers (details and measurements below). Screens use two hooks from
`src/app/library-hooks.ts`:

* `useLibraryPage(query)` → `{ page, error }`. Reruns when the query (compared by value) or the
  library changes, keeps the previous page on screen while the next loads, drops answers that
  arrive late or out of order, and keeps the last good page if a request fails.
* `useLibraryRevision()` → a new object whenever books, shelves, shelf links or progress change
  (counts only, no data loaded). Use it to refresh anything else (for example the shelf list).

#### Cost of a change, measured (5,000 books)

The first query after a single write used to read the whole `books` table again. Measured in headless
Chrome 156 on the build machine (real IndexedDB, main thread, 100 runs each; the first number is the
median and the second the 95th percentile, in ms):

| First query after... | Before: re-read the table | After: patch the snapshot |
| --- | --- | --- |
| one metadata edit (default list) | 41.1 / 54.9 | 0.5 / 0.9 |
| one metadata edit (title-sorted list) | 46.3 / 60.9 | 0.7 / 1.3 |
| one metadata edit (search "silv lan") | 38.4 / 48.8 | 2.0 / 2.7 |
| one import (`add`) | 38.9 / 47.2 | 0.7 / 0.9 |
| opening a book (`markOpened`) | 38.5 / 44.6 | 0.7 / 1.1 |
| a write from another connection (the import worker) | 37.4 / 43.6 | 0.7 / 1.1 |
| (reference) a query with no write in between | 0.4 / 0.7 | 0.2 / 0.6 |

Node with fake-indexeddb, same scenarios, before: 22–31 ms median, 27–60 ms p95; after: 0.5–1.8 ms
median, 0.7–2.2 ms p95. Casey's bar was 30 ms. The old cost was over it in the real browser (about
40 ms median on a desktop-class CPU, so more on a phone), so the snapshot is now **patched**:

* The change event names the primary keys that were written or deleted. Only those books are read
  again (`bulkGet`), re-indexed and put into the snapshot, and moved to their new place in every
  sorted list that was already built (binary insertion), so nothing is re-sorted.
* Writes by this connection and by any other (import worker, another tab) arrive the same way.
* If a change cannot be named (the database was just opened, `clear()`, or more than 500 books
  changed at once) the table is read once, as before.
* The public API did not change.

These runs are on a desktop-class CPU in headless Chrome, not a phone. A phone is slower (budget
roughly 3 to 5 times), so the old path would have been well over 100 ms there and the new one is
still around 10 ms or less. No run on a real phone has been made yet.

**Reproduce:** `node scripts/bench-library.mjs` (add `--node` or `--browser`, `--books 5000`,
`--runs 100`). It builds a throwaway bundle of the real `BookRepository` and `LibraryQueryService`, seeds
the books and prints JSON. The browser run needs Chrome (`/usr/bin/google-chrome`) and uses a page
served from memory by Playwright; nothing touches the network.

**Guarding it:** timing on a shared CI machine is flaky, so the tests count what is read instead:
`library-query-patch.test.ts` fails if one write at 5,000 books reads anything but that one row
(`toArray` must not be called, `bulkGet` must get exactly the written id). The same file holds the
correctness oracle: after every kind of write (add, update, markOpened, trash, restore, purge,
remove, cover changes, writes from a second connection, overlapping queries and writes) the
long-lived service must answer exactly like a brand-new one for twelve different queries.

A bulk import of hundreds of books still means a few small reads per screen refresh, not a table
read. Screens may debounce `useLibraryRevision` if a very fast import makes the grid flicker.

### Showing a grid of 5,000 books

Use `limit` and `offset` (or the Library's windowed list) rather than asking for everything:
`limit` is capped at 500. The placeholder `LibraryPage` in `src/app` shows the first 500 and says
"Showing 500 of N books." Do not call `db.books.toArray()` or `db.progress.toArray()` from a screen.

## Import jobs

There is **no import-job store** and no schema change (Casey's decision). The importer keeps job
state in memory and calls `add` per file. `add` is atomic, so an interrupted import leaves either
a whole book or nothing (plus orphan files that `cleanupOrphans()` removes at the next start).

If the app is closed in the middle of an import, the person adds the folder again. Books that were
already stored are recognised by their fingerprint, come back as `{ status: 'duplicate' }`, and are
skipped without copying anything (`findByFingerprint` answers before any bytes are read or written),
so re-adding the same folder only imports what is missing.

## What was changed in shared code

* `src/data/rpc.ts`: nested namespaces (`books.add`), `MethodPath<T>`, and refusal of method names
  every object has (`constructor`, `toString`, `__proto__`, …) or that do not resolve to a function.
* `src/data/data-service.ts` / `data-client.ts`: the three namespaces; `createDataService` returns a
  service with `dispose()` (not callable over RPC). The in-process fallback now loads the service
  on demand, so browsers with Workers never download a second copy.
* `src/data/data-service-methods.ts`: the method names, split out so the main thread knows them
  without importing the service.
* `src/app/services-context.ts`: `AppServices.covers`.
* `src/data/library-query.ts`: the snapshot is patched from change events (see "Cost of a change").
* `src/data/books.ts`: `cleanupOrphans()` guard and `WriteLocks` (an optional fourth constructor
  argument; it defaults to `navigator.locks`).
* `scripts/bench-library.mjs` and `scripts/bench/library-bench-core.mjs`: the benchmark.

## Tests

`books.test.ts`, `collections.test.ts`, `cover-url.test.ts`, `library-index.test.ts`,
`library-query.test.ts` (including the 20,000-book run), nested RPC in `rpc.test.ts`, the full
path through a worker and through the in-process fallback in `data-client.test.ts` (including an
import-worker-style second connection), and `src/app/library-page.test.tsx` for the hooks and the page.
Shared helpers: `src/data/test-fixtures.ts` (a fresh database and in-memory file store per test).
