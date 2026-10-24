import type { ImportResult } from './sample-book';

/** What happened to one file the person chose: either it was added (or was already there), or it failed. */
export type ImportOutcome =
  | {
      readonly fileName: string;
      /** The book, shaped like {@link ImportResult}. `alreadyInLibrary` is true when the same file was there before. */
      readonly result: ImportResult;
    }
  | {
      readonly fileName: string;
      /** Plain words for the person (for example from `PLAIN_ERRORS`), never a code or a stack trace. */
      readonly error: string;
    };

/**
 * Adds the files a person picks to the library.
 *
 * **Who implements it.** The Library owner. The same Library provider object normally implements
 * both `BookImporter` (this) and `SampleBookProvider`: the sample is one file that goes through
 * the same import path. Register it as `AppServices.importer` (and `AppServices.sampleBook`).
 *
 * **What the app does with it.** The Library's "Add books" button opens the system file picker
 * with {@link BookImporter.accept}, hands the chosen files to {@link BookImporter.importFiles},
 * and reports the outcomes: a snackbar for books added, a notice with the plain-words `error` for
 * files that failed. When no importer is registered, or {@link BookImporter.available} is false,
 * the button explains that adding is not ready; it never pretends to work.
 *
 * Rules for an implementation:
 * - Everything runs on the person's device. Files are never uploaded.
 * - Files go through the **normal import path** (content-based format detection, fingerprint,
 *   metadata, OPFS copy, `books` row, cover), so duplicates, covers and progress behave the same
 *   for every source.
 * - Heavy work (hashing, parsing) belongs in a worker, not on the main thread.
 * - It does **not** navigate and does not show UI. The app decides what to show.
 */
export interface BookImporter {
  /** Value for the file input's `accept` attribute, for example `.epub,.pdf,.mp3,.m4b`. */
  readonly accept: string;
  /**
   * False while import cannot run (for example the worker failed to start). Synchronous and cheap:
   * it is called on every tap of "Add books".
   */
  available(): boolean;
  /**
   * Import the files, one outcome per file **in the same order as `files`**. Resolves even when
   * some files fail (those get an `error` outcome). Rejects only when nothing could run at all;
   * the app then says "Nothing was added. Please try again." Calling it again afterwards is safe.
   */
  importFiles(files: readonly File[]): Promise<readonly ImportOutcome[]>;
}
