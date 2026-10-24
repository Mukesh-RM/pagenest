import type { TextRange, Unsubscribe } from '@/app/contracts';
import type { OpenOptions, ReaderDocument, ReaderEngine, ReaderSource } from '@/engines/reader/types';

/**
 * Extras the reader screen needs on top of the Architect's `ReaderDocument` contract. Every engine in
 * `engines/pdf` and `engines/epub` returns a {@link ReaderDocumentExt}; the contract itself is untouched.
 */
export interface ReaderDocumentExt extends ReaderDocument {
  /** `fixed` for page based content (PDF, CBZ), `reflow` for text that repaginates. */
  readonly layout: 'fixed' | 'reflow';
  /** Jump to a point of the whole document, 0 to 1 (the scrubber). */
  goToFraction(fraction: number): Promise<void>;
  /** Chapter starts as fractions of the whole document (ticks on the scrubber). */
  chapterTicks(): readonly number[];
  /** A short plain-text label for the current spot, used as the default bookmark name. */
  currentLabel(): string;
  /** Rough minutes left in the current chapter (or document) at `wordsPerMinute`; `undefined` when unknown. */
  minutesLeft(wordsPerMinute?: number): number | undefined;
  /** Where the current selection is, in the host element's coordinates. */
  selectionRect(): DOMRect | undefined;
  /** Clear the selection (after a highlight is made). */
  clearSelection(): void;
  /** Key presses seen inside the document (iframes swallow them). Not called for keys the engine used. */
  onKey(listener: (event: KeyboardLike) => void): Unsubscribe;
  /** A highlight was tapped. */
  onHighlightTap(listener: (id: string) => void): Unsubscribe;
  /** Jump to a range (search hit, highlight). Resolves once visible. */
  goToRange(range: TextRange): Promise<void>;
  /** Mark search hits on the page; pass `[]` to clear. */
  showSearchHits(ranges: readonly TextRange[]): void;
  /** The table of contents changed (PDF outlines resolve in the background). */
  onTocChange(listener: () => void): Unsubscribe;
  /** Zoom of fixed-layout content, 1 = fit width. Absent for reflowable books (they change font size instead). */
  readonly zoom?: { get(): number; set(zoom: number): void };
}

/** The part of `KeyboardEvent` the reader uses; also what iframes forward. */
export interface KeyboardLike {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  preventDefault(): void;
}

/** An engine that returns extended documents. */
export interface ReaderEngineExt extends ReaderEngine {
  open(source: ReaderSource, host: HTMLElement, options?: OpenOptions): Promise<ReaderDocumentExt>;
}
