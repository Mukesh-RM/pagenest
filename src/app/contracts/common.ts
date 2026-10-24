/**
 * Small shared vocabulary used by every contract (blueprint sections 6, 12 and 13).
 * Types only: no runtime code lives here.
 */

/** Broad class of a library item (blueprint section 13, `books.kind`). */
export type BookKind = 'ebook' | 'pdf' | 'doc' | 'audio';

/**
 * File format of a library item. Lowercase, no dot.
 * Reflowable e-book formats are handled by foliate-js, `pdf` by pdf.js,
 * `docx` by mammoth.js, audio formats by the HTML audio element.
 */
export type BookFormat =
  | 'epub'
  | 'mobi'
  | 'azw3'
  | 'fb2'
  | 'cbz'
  | 'pdf'
  | 'docx'
  | 'txt'
  | 'rtf'
  | 'html'
  | 'md'
  | 'djvu'
  | 'mp3'
  | 'm4b'
  | 'm4a'
  | 'aac'
  | 'ogg'
  | 'opus'
  | 'flac'
  | 'wav';

/** How a book is being consumed (blueprint section 13, `progress.mode`). */
export type ProgressMode = 'read' | 'listen' | 'aloud';

/** Opaque, stable identifier for a database record (a UUID string). */
export type EntityId = string;

/**
 * Relative path inside the origin private file system (OPFS), for example
 * `books/3f2a.../book.epub`. Always `/`-separated, never starts with `/`.
 */
export type FileRef = string;

/** Call the returned function to stop listening. Safe to call more than once. */
export type Unsubscribe = () => void;

/** Reporting channel for long tasks such as model downloads or renders. */
export interface ProgressReport {
  /** Work done so far, in the same unit as `total`. */
  readonly done: number;
  /** Total work, or `undefined` when unknown. */
  readonly total?: number;
}
