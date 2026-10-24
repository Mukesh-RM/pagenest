import type { ImportResult } from './sample-book';

/** What happened to one file the person chose. */
export type ImportOutcome =
  | { readonly fileName: string; readonly result: ImportResult }
  | {
      readonly fileName: string;
      /** Plain words for the person (for example from `PLAIN_ERRORS`), never a code or a stack trace. */
      readonly error: string;
    };

/**
 * Adds the files a person picks to the library. Implemented by the Library owner (import worker,
 * metadata, covers, fingerprints) and registered through `AppServices.importer`.
 *
 * The app uses it for the Library's "Add books" button: it opens the system file picker with
 * {@link BookImporter.accept}, hands the chosen files to {@link BookImporter.importFiles}, and
 * shows the outcomes. When no importer is registered the Add button explains that adding is not
 * available in this build; it never pretends to work.
 */
export interface BookImporter {
  /** Value for the file input's `accept` attribute, for example `.epub,.pdf,.mp3,.m4b`. */
  readonly accept: string;
  /** False while import cannot run (for example the worker failed to start). */
  available(): boolean;
  /**
   * Import the files, one outcome per file in the same order. Resolves even when some files fail
   * (those get an `error` outcome); rejects only when nothing could run at all.
   */
  importFiles(files: readonly File[]): Promise<readonly ImportOutcome[]>;
}
