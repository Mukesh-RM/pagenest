# Importer contract: adding books from the person's own files

The contract is `BookImporter` in `src/app/contracts/importer.ts`, exported from
`@/app/contracts`. It is the sibling of `SampleBookProvider` (`sample-book.ts`).

**The Library bot's real provider implements both.** One object, registered once:

```ts
const library = createLibraryProvider(/* data client, import worker */);
const services: AppServices = { ...base, importer: library, sampleBook: library };
```

## What the app does

| Situation | What the person sees |
| --- | --- |
| No importer registered, or `available()` is false | Tapping **Add books** shows a notice "Adding books is not ready yet" (dismissible). No file picker. |
| Importer available | Tapping **Add books** opens the system file picker filtered by `accept`. |
| Files chosen | `importFiles(files)` is called once. One new book: "Added to your library." Several: "Added N books to your library." |
| Only duplicates (`alreadyInLibrary: true`) | "That book is already in your library." |
| A file has an `error` outcome | A dismissible alert with that plain-words text. Other files still count as added. |
| `importFiles` rejects | A dismissible alert: "Nothing was added. Please try again." |

## Rules for the implementation

* One `ImportOutcome` per file, **same order** as the input. Resolve even if some files fail.
* `error` is plain words fit to show (use `PLAIN_ERRORS`), never a code or stack trace.
* Use the normal import path (format from content, fingerprint, metadata, OPFS, `books` row, cover).
  `SampleBookProvider.importSample` uses the same path for its one file.
* Everything stays on the device; heavy work runs in a worker.
* No navigation and no UI inside the importer.
* Calling `importFiles` again after a rejection must be safe.

## Testing against the contract

`src/app/contracts/importer.test.ts` compiles a fake implementation against `BookImporter` and
checks the shape rules (order, mixed outcomes). `src/app/library-page.test.tsx` covers the Add
button with a registered, unavailable, failing and duplicate-only importer.
