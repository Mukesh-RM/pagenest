import type { BookFormat, BookKind, EntityId } from './common';

/** What `importSample` produced. Shaped like the result of the normal import path. */
export interface ImportResult {
  /** The book's id in the `books` store. */
  readonly bookId: EntityId;
  /**
   * **Route by `kind`.** Decides whether the book opens in the reader (`/read/:id`, for
   * `ebook`, `pdf` and `doc`) or the player (`/listen/:id`, for `audio`). Use `pathForBook`.
   */
  readonly kind: BookKind;
  /**
   * **Engines pick by `format`.** The real file format, detected from the file's content (not
   * its name or extension), for example `epub`, `pdf`, `mp3` or `m4b`. The reader or player
   * chooses its engine from this value. It is the same value stored in the book's `format` field.
   */
  readonly format: BookFormat;
  readonly title: string;
  /** True when the same file (same fingerprint) was already in the library, so nothing new was added. */
  readonly alreadyInLibrary: boolean;
}

/** What the Library card tells the person before they tap. All of it is shown as written. */
export interface SampleBookInfo {
  readonly title: string;
  readonly author: string;
  /** Plain words, for example "Public domain". */
  readonly license: string;
  /** Where the text came from, for example "Project Gutenberg, ebook 1342". */
  readonly provenance: string;
}

/**
 * Lets a person try InkQuiet with no file of their own: one small public-domain book that opens
 * in a few seconds. The Library owner implements it; the app only talks to this interface.
 *
 * Rules for an implementation:
 * - It fetches **one** small public-domain EPUB from **our own origin**, never from a third party.
 * - It does that only inside {@link SampleBookProvider.importSample}, that is, when the person taps.
 *   Nothing is downloaded at startup or in the background.
 * - The EPUB is **not** precached by the service worker, so it does not add to the first install.
 * - The file goes through the **normal import path** (fingerprint, metadata, OPFS, `books` row),
 *   so duplicate detection, covers and progress behave exactly as for any other book.
 * - Its license must be listed in `docs/LICENSES.md`.
 *
 * The app shows the "Try a sample book" card only when a provider is registered in
 * `AppServices.sampleBook` **and** {@link SampleBookProvider.available} returns true, so there is
 * never a button that does nothing.
 */
export interface SampleBookProvider {
  /** Shown on the card. */
  readonly info: SampleBookInfo;

  /**
   * True when the sample can be added right now (for example the file is part of this build).
   * Synchronous and cheap: it is called on every render of the empty Library.
   */
  available(): boolean;

  /**
   * Download (from our own origin) and import the sample. Resolves with the book to open.
   * Rejects with an `Error` whose `message` is plain words fit to show a person
   * ("Could not add the sample book. Check your connection and try again.").
   * Calling it again after a rejection must be safe.
   */
  importSample(): Promise<ImportResult>;
}
