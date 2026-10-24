import type {
  BookFormat,
  EntityId,
  Locator,
  TextRange,
  Unsubscribe,
} from '@/app/contracts';

/**
 * Reader engine contract (blueprint sections 7 and 12.2).
 *
 * PDF (pdf.js) and reflowable formats (foliate-js, mammoth.js, built-in
 * converters) both implement `ReaderEngine`, so there is one reader UI. A new
 * format is a new engine registered with the app, never a change to the UI.
 *
 * Engines must do parsing, tiling and indexing in workers; the main thread
 * only draws. Engines never touch the network.
 */
export interface ReaderEngine {
  /** Stable engine id, for example `pdfjs` or `foliate`. */
  readonly id: string;

  /** Formats this engine opens. */
  readonly formats: readonly BookFormat[];

  /** Whether this engine can open `format`. Must agree with {@link ReaderEngine.formats}. */
  canOpen(format: BookFormat): boolean;

  /**
   * Open a document and mount it into `host`. Resolves when the first page or
   * section is visible (target: under 1.5 s for a 50 MB PDF or 5 MB EPUB).
   *
   * @throws ReaderError with code `drm` for protected files (never bypass),
   *   `corrupt` for damaged files, `unsupported` for formats it cannot open.
   */
  open(source: ReaderSource, host: HTMLElement, options?: OpenOptions): Promise<ReaderDocument>;
}

/** Where the file bytes come from. */
export interface ReaderSource {
  readonly bookId: EntityId;
  readonly format: BookFormat;
  /**
   * The file, as read from OPFS. Engines must stream or slice it and never
   * load a large file whole into memory when the format allows it.
   */
  readonly file: Blob;
}

/** Options for {@link ReaderEngine.open}. */
export interface OpenOptions {
  /** Where to start. Omit to start at the beginning. */
  readonly locator?: Locator;
  /** Initial look. Can be changed later with {@link ReaderDocument.applyAppearance}. */
  readonly appearance?: ReaderAppearance;
  /** Abort opening, for example when the user goes back. */
  readonly signal?: AbortSignal;
}

/** Reading look (blueprint section 5.3 and the Aa sheet in 5.6). */
export interface ReaderAppearance {
  /** Reader theme, separate from the app theme. */
  readonly theme: 'light' | 'sepia' | 'dark' | 'black' | 'custom';
  /** Colors used when `theme` is `custom`, as CSS color strings. */
  readonly custom?: { readonly page: string; readonly text: string; readonly accent: string };
  /** CSS `font-family` value. */
  readonly fontFamily: string;
  /** Font size in px, 12 to 40. */
  readonly fontSizePx: number;
  /** Line height multiplier, 1.2 to 2.0. */
  readonly lineHeight: number;
  /** Extra space between paragraphs in em. */
  readonly paragraphSpacingEm: number;
  readonly margins: 'narrow' | 'normal' | 'wide';
  readonly align: 'left' | 'justify';
  readonly hyphenate: boolean;
  /** How pages change. Fixed-layout formats ignore `curl` and `slide` where not applicable. */
  readonly pageTurn: 'slide' | 'curl' | 'scroll' | 'none';
}

/** One entry of the table of contents. */
export interface TocItem {
  readonly title: string;
  /** Where the entry points. */
  readonly locator: Locator;
  /** Nested entries. */
  readonly children?: readonly TocItem[];
}

/** Metadata the engine could read from the file. Missing values are `undefined`. */
export interface DocumentMetadata {
  readonly title?: string;
  readonly author?: string;
  readonly language?: string;
  readonly series?: string;
  /** Page count, for fixed-layout formats. */
  readonly pages?: number;
  /** Cover image bytes, if the file has one. */
  readonly cover?: Blob;
}

/** A full-text search result. */
export interface SearchHit {
  /** Where the match starts and ends. */
  readonly range: TextRange;
  /** The matched text with a little context around it. */
  readonly excerpt: string;
  /** Start and end offsets of the match inside `excerpt`. */
  readonly matchStart: number;
  readonly matchEnd: number;
}

/** Highlight colors (blueprint section 7: four colors). */
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';

/** What the reader is currently showing. */
export interface ReaderPosition {
  readonly locator: Locator;
  /** Overall progress through the document, 0 to 100. */
  readonly percent: number;
  /** Chapter title at this position, if known. */
  readonly chapterTitle?: string;
  /** Current page number (1-based) and total, for formats that have fixed pages. */
  readonly page?: number;
  readonly pageCount?: number;
}

/** A user text selection inside the document. */
export interface ReaderSelection {
  readonly range: TextRange;
  readonly text: string;
}

/**
 * An open document. Obtained from {@link ReaderEngine.open}; call
 * {@link ReaderDocument.close} when done to free workers and memory.
 */
export interface ReaderDocument {
  readonly metadata: DocumentMetadata;
  /** Table of contents; empty array when the file has none. */
  readonly toc: readonly TocItem[];

  /** Current position (the locator the ProgressService stores). */
  position(): ReaderPosition;

  /** Jump to a locator. Resolves once it is visible. Unusable locators fall back to their section or page. */
  goTo(locator: Locator): Promise<void>;
  /** Next page, or next screen when scrolling. Resolves `false` at the end. */
  next(): Promise<boolean>;
  /** Previous page. Resolves `false` at the start. */
  prev(): Promise<boolean>;

  /** Change the look. Keeps the same sentence after re-pagination. */
  applyAppearance(appearance: ReaderAppearance): Promise<void>;

  /**
   * Search the whole document. Results stream as they are found. Stop
   * early with `signal`. The index is built once per book in a worker.
   */
  search(query: string, signal?: AbortSignal): AsyncIterable<SearchHit>;

  /** The current user selection, or `undefined`. */
  selection(): ReaderSelection | undefined;

  /** Show, update or remove a highlight (stored by the app as a range). */
  showHighlight(id: EntityId, range: TextRange, color: HighlightColor): void;
  hideHighlight(id: EntityId): void;

  /**
   * Listen for position changes (scroll, page turn, resize). Fires often;
   * pass the result to `ProgressService.report`, which throttles saves.
   */
  onPositionChange(listener: (position: ReaderPosition) => void): Unsubscribe;
  /** Listen for selection changes, `undefined` when cleared. */
  onSelectionChange(listener: (selection: ReaderSelection | undefined) => void): Unsubscribe;
  /** Listen for taps that the engine did not use (to toggle overlays). `zone` is the third of the screen. */
  onTap(listener: (zone: 'left' | 'center' | 'right') => void): Unsubscribe;

  /** Release workers, listeners and DOM. The document cannot be used afterwards. */
  close(): Promise<void>;
}

/** Why opening or using a document failed. Messages are plain words, never codes or stack traces. */
export type ReaderErrorCode = 'drm' | 'corrupt' | 'unsupported' | 'aborted';

/** Error thrown by engines. `message` is safe to show to the user. */
export interface ReaderError extends Error {
  readonly code: ReaderErrorCode;
}
