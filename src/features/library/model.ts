import type { BookRecord } from '@/data/schema';
import type { LibraryQuery } from '@/data/library-query';

type StoredBook = Pick<BookRecord, 'format' | 'finished'>;

/** Library view logic with no React and no storage, so it is easy to test. */

/** `recent` is last opened (then newest added), `added` is newest added, as in the data layer's `LibraryQuery.sort`. */
export type SortKey = 'recent' | 'added' | 'title' | 'author';
/** One filter at a time, as a row of chips. `all` shows every book. */
export type FilterId = 'all' | 'favorites' | 'reading' | 'listening' | 'finished';
/** All / Books / Audio (ReadEra parity); maps to `LibraryQuery.segment`. */
export type SegmentId = 'all' | 'books' | 'audio';
export type ViewMode = 'grid' | 'list';

/** Same ids and words as the design system's Library screen (`DEFAULT_LIBRARY_SORTS`). */
export const SORT_LABELS: Readonly<Record<SortKey, string>> = {
  recent: 'Recently opened',
  added: 'Recently added',
  title: 'Title',
  author: 'Author',
};
export const SORT_KEYS = Object.keys(SORT_LABELS) as SortKey[];

/**
 * The filter row: the design system's four (`DEFAULT_LIBRARY_FILTERS`) plus Favorites, second so it
 * is on screen without scrolling. The row scrolls sideways, with a fade at its end, never wraps.
 */
export const FILTERS: readonly { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'reading', label: 'Reading' },
  { id: 'listening', label: 'Listening' },
  { id: 'finished', label: 'Finished' },
];

export const SEGMENTS: readonly { id: SegmentId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'books', label: 'Books' },
  { id: 'audio', label: 'Audio' },
];

export interface LibraryPrefs {
  view: ViewMode;
  sort: SortKey;
  segment: SegmentId;
}
export const DEFAULT_PREFS: LibraryPrefs = { view: 'grid', sort: 'recent', segment: 'all' };

export const SORT_DIRECTIONS: Readonly<Record<SortKey, 'asc' | 'desc'>> = { recent: 'desc', added: 'desc', title: 'asc', author: 'asc' };

export function isSortKey(v: unknown): v is SortKey {
  return typeof v === 'string' && v in SORT_LABELS;
}
export function isViewMode(v: unknown): v is ViewMode {
  return v === 'grid' || v === 'list';
}
export function isSegmentId(v: unknown): v is SegmentId {
  return v === 'all' || v === 'books' || v === 'audio';
}

/** Read saved preferences; anything invalid keeps its default. */
export function parsePrefs(value: unknown): LibraryPrefs {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  return {
    view: isViewMode(v['view']) ? v['view'] : DEFAULT_PREFS.view,
    sort: isSortKey(v['sort']) ? v['sort'] : DEFAULT_PREFS.sort,
    segment: isSegmentId(v['segment']) ? v['segment'] : DEFAULT_PREFS.segment,
  };
}

/** What the screen asks the data layer for. */
export interface ViewQuery {
  text: string;
  filter: FilterId;
  sort: SortKey;
  segment: SegmentId;
  collectionId?: string | undefined;
}

/** The data layer query for what is on screen. A shelf keeps its own order unless a sort is chosen. */
export function toLibraryQuery(view: ViewQuery): Partial<LibraryQuery> {
  const text = view.text.trim();
  return {
    ...(text ? { text } : {}),
    ...(view.segment === 'all' ? {} : { segment: view.segment }),
    ...(view.filter === 'all' ? {} : { status: view.filter }),
    ...(view.collectionId ? { collectionId: view.collectionId } : {}),
    // A search ranks by relevance; everything else uses the person's sort.
    ...(text ? {} : { sort: view.sort }),
  };
}

export function isFinished(book: Pick<StoredBook, 'finished'>, percent: number): boolean {
  return book.finished || percent >= 100;
}

/** Short format tag on a cover: `EPUB`, `M4B`. */
export function formatTag(book: Pick<StoredBook, 'format'>): string {
  return book.format.toUpperCase();
}

/** "3 h 20 min" for audio, or `undefined`. */
export function formatDuration(seconds: number | undefined): string | undefined {
  if (!seconds || seconds < 1) return undefined;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
