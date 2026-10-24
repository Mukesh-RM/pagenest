# ProgressService contract

Blueprint sections 7, 8.1 and 12.2: one service saves reading, listening and read-aloud positions through one
position type, so every feature resumes the same way.

- Interface and types: `src/app/contracts/progress.ts`, `src/app/contracts/locator.ts`
- Implementation: `src/data/progress-service.ts` (`DexieProgressService`, IndexedDB `progress` store)
- Owner: Architect. Ask Casey before changing the contract.

## Locator

A `Locator` is plain JSON data (it survives IndexedDB, backup files and structured clone). Three kinds:

| kind | Used for | Fields |
|---|---|---|
| `page` | PDF, CBZ (fixed layout) | `page` (1-based integer), `offset` (0 to 1, how far down the page) |
| `reflow` | EPUB, MOBI, AZW3, FB2, DOCX, TXT, ... | `section` (0-based), `textOffset` (0-based UTF-16 offset in the section text), optional `cfi`, optional `sentence` |
| `audio` | Audiobooks | `trackIndex` (0-based; always 0 for one-file M4B), `positionSec` (seconds into that track) |

Rules:

1. Reflowable positions are stored by **text position**, never by page number, so changing font size keeps the same sentence.
2. `cfi` is an optional accelerator. If it cannot be resolved, engines fall back to `section` + `textOffset`.
3. Audio positions are per track so folders of MP3 files work; book time = `track.startOffsetSec + positionSec`.
4. Validate data from outside the type system with `isLocator()`. Damaged stored locators are ignored, not thrown.
5. Which kind fits which mode (`isLocatorForMode`):

| mode | allowed kinds |
|---|---|
| `read` | `page`, `reflow` |
| `listen` | `audio` |
| `aloud` | `reflow` (set `sentence`) |

Helpers: `isLocator`, `isLocatorForMode`, `locatorsEqual`, `compareLocators` (same kind only; `undefined` otherwise), `clampPercent`.

## Record

One row per `(bookId, mode)`: `{ bookId, mode, locator, percent (0 to 100), updatedAt (epoch ms) }`.
Saving a position also sets `books.lastOpenedAt` when the book row exists.

## Methods and timing

| Method | When to call | Behavior |
|---|---|---|
| `report(bookId, mode, locator, percent)` | Scroll, page turn, audio `timeupdate` (as often as you like) | Synchronous and cheap. Keeps only the newest value per key. One timer writes all pending values 5 s after the first unsaved report. |
| `flush(bookId?)` | Pause, page hide, close, track change, leaving a screen | Writes pending reports now. Resolves when written. |
| `save(...)` | One-off exact saves (chapter jump, bookmark, finish) | Writes now, discards the pending report for that key. |
| `get(bookId, mode)` | Opening a book in a mode | Pending (unwritten) value first, then the stored one. |
| `getLatest(bookId)` | "Resume where I was" | Newest `updatedAt` across modes. |
| `clear(bookId)` | Deleting a book | Removes stored and pending positions. |
| `subscribe(listener)` | Library progress bars | Called after each write. Returns an unsubscribe function. |

Guarantees:

- Writes are serialized, so an older position never overwrites a newer one.
- `report` and `save` throw `RangeError` for a locator that is malformed or wrong for the mode. Nothing is written.
- `percent` is clamped to 0 to 100 (NaN becomes 0).
- `get` and `getLatest` wait for in-flight writes, so they never return something older than a completed `save`.

## Page lifecycle

Call `attachProgressLifecycle(service, { visibility: document, page: window })` once at startup. It flushes on
`visibilitychange` (when hidden) and `pagehide`, so a killed app still resumes at the same spot. Engines must also call
`flush()` themselves on pause and close.

## Usage

```ts
// Reader: on every relocate
progress.report(bookId, 'read', position.locator, position.percent);

// Reader: on open
const saved = await progress.get(bookId, 'read');
const doc = await engine.open(source, host, saved ? { locator: saved.locator } : undefined);

// Audio: on pause
audio.pause();
await progress.flush(bookId);
```

## Not covered here

Per-session listening and reading time for Stats is the `sessions` store, written by the player and reader features.
Bookmarks and highlights use `Locator` and `TextRange` in their own stores.
