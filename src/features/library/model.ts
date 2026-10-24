import type { BookRecord } from '@/data/schema';
import type { LibraryQuery } from '@/data/library-query';

type StoredBook = Pick<BookRecord, 'id' | 'title' | 'author' | 'kind' | 'format' | 'favorite' | 'finished'>;

/** Library view logic with no React and no storage, so it is easy to test. */

/** `recent` is last opened (then newest added), `added` is newest added, as in the data layer's `LibraryQuery.sort`. */
export type SortKey = 'recent' | 'added' | 'title' | 'author';
export type Segment = 'all' | 'books' | 'audio';
export type FilterChip = 'reading' | 'listening' | 'finished' | 'favorites';
export type ViewMode = 'grid' | 'list';

export const SORT_LABELS: Readonly<Record<SortKey, string>> = {
  recent: 'Recently opened',
  added: 'Recently added',
  title: 'Title, A to Z',
  author: 'Author, A to Z',
};
export const SORT_KEYS = Object.keys(SORT_LABELS) as SortKey[];

export const SEGMENT_LABELS: Readonly<Record<Segment, string>> = { all: 'All', books: 'Books', audio: 'Audio' };
export const CHIP_LABELS: Readonly<Record<FilterChip, string>> = {
  reading: 'Reading now',
  listening: 'Listening',
  finished: 'Finished',
  favorites: 'Favorites',
};

export interface LibraryPrefs {
  view: ViewMode;
  sort: SortKey;
  segment: Segment;
}
export const DEFAULT_PREFS: LibraryPrefs = { view: 'grid', sort: 'recent', segment: 'all' };

export const SORT_DIRECTIONS: Readonly<Record<SortKey, 'asc' | 'desc'>> = { recent: 'desc', added: 'desc', title: 'asc', author: 'asc' };

export function isSortKey(v: unknown): v is SortKey {
  return typeof v === 'string' && v in SORT_LABELS;
}
export function isSegment(v: unknown): v is Segment {
  return v === 'all' || v === 'books' || v === 'audio';
}
export function isViewMode(v: unknown): v is ViewMode {
  return v === 'grid' || v === 'list';
}

/** Read saved preferences; anything invalid keeps its default. */
export function parsePrefs(value: unknown): LibraryPrefs {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  return {
    view: isViewMode(v['view']) ? v['view'] : DEFAULT_PREFS.view,
    sort: isSortKey(v['sort']) ? v['sort'] : DEFAULT_PREFS.sort,
    segment: isSegment(v['segment']) ? v['segment'] : DEFAULT_PREFS.segment,
  };
}

/** What the screen asks the data layer for. */
export interface ViewQuery {
  text: string;
  segment: Segment;
  chip: FilterChip | null;
  sort: SortKey;
  collectionId?: string | undefined;
}

/** The data layer query for what is on screen. A shelf keeps its own order unless a sort is chosen. */
export function toLibraryQuery(view: ViewQuery): Partial<LibraryQuery> {
  const text = view.text.trim();
  return {
    ...(text ? { text } : {}),
    segment: view.segment,
    ...(view.chip ? { status: view.chip } : {}),
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

/** Screen-reader sentence for one book, for cards and rows. */
export function describeBook(book: StoredBook, percent: number): string {
  const parts = [book.title];
  if (book.author) parts.push(`by ${book.author}`);
  parts.push(book.kind === 'audio' ? 'audiobook' : book.format === 'pdf' ? 'PDF' : 'book');
  if (isFinished(book, percent)) parts.push('finished');
  else if (percent > 0) parts.push(`${Math.round(percent)} percent done`);
  if (book.favorite) parts.push('favorite');
  return parts.join(', ');
}

/** Four-px-grid title card colors: 12 pairs that keep text above 4.5:1 (checked by a test). */
export const CARD_COLORS: readonly { bg: string; fg: string }[] = [
  { bg: '#7A2E2E', fg: '#FFFFFF' },
  { bg: '#8A4B14', fg: '#FFFFFF' },
  { bg: '#6B5A0E', fg: '#FFFFFF' },
  { bg: '#3F6212', fg: '#FFFFFF' },
  { bg: '#166534', fg: '#FFFFFF' },
  { bg: '#0F5E5E', fg: '#FFFFFF' },
  { bg: '#1D4E89', fg: '#FFFFFF' },
  { bg: '#3730A3', fg: '#FFFFFF' },
  { bg: '#5B2A86', fg: '#FFFFFF' },
  { bg: '#86198F', fg: '#FFFFFF' },
  { bg: '#9D174D', fg: '#FFFFFF' },
  { bg: '#374151', fg: '#FFFFFF' },
];

/** The same title always gets the same color pair. */
export function cardColor(seed: string): { bg: string; fg: string } {
  let hash = 5381;
  for (let i = 0; i < seed.length; i += 1) hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  return CARD_COLORS[Math.abs(hash) % CARD_COLORS.length] as { bg: string; fg: string };
}

/** Up to two capital letters for the corner of a title card. */
export function initials(title: string): string {
  const words = title
    .replace(/^(the|a|an)\s+/i, '')
    .split(/[\s\-–—:;,.]+/)
    .filter((w) => /\p{L}/u.test(w));
  const letters = words.slice(0, 2).map((w) => (Array.from(w.replace(/^[^\p{L}]+/u, ''))[0] ?? '').toLocaleUpperCase());
  return letters.join('') || '?';
}
