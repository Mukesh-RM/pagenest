import type { StoredBook } from '@/workers/import/protocol';

/** Library view logic with no React and no storage, so it is easy to test. */

export type SortKey = 'recent' | 'opened' | 'title' | 'author';
export type Segment = 'all' | 'books' | 'audio';
export type FilterChip = 'reading' | 'listening' | 'finished' | 'favorites';
export type ViewMode = 'grid' | 'list';

export const SORT_LABELS: Readonly<Record<SortKey, string>> = {
  recent: 'Recently added',
  opened: 'Recently opened',
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

export interface ViewOptions {
  segment: Segment;
  chip: FilterChip | null;
  sort: SortKey;
  /** Ids from a search, best first. `null` means no search. */
  searchIds: readonly string[] | null;
  /** Only books on this shelf. */
  only?: ReadonlySet<string> | undefined;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function isFinished(book: StoredBook, percent: number): boolean {
  return book.finished || percent >= 100;
}

/** Does this book pass the chip filter? */
export function matchesChip(book: StoredBook, percent: number, chip: FilterChip): boolean {
  switch (chip) {
    case 'reading':
      return book.kind !== 'audio' && percent > 0 && !isFinished(book, percent);
    case 'listening':
      return book.kind === 'audio' && percent > 0 && !isFinished(book, percent);
    case 'finished':
      return isFinished(book, percent);
    case 'favorites':
      return book.favorite;
  }
}

function compare(sort: SortKey): (a: StoredBook, b: StoredBook) => number {
  switch (sort) {
    case 'recent':
      return (a, b) => b.addedAt - a.addedAt || collator.compare(a.title, b.title);
    case 'opened':
      return (a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0) || b.addedAt - a.addedAt;
    case 'title':
      return (a, b) => collator.compare(a.title, b.title) || b.addedAt - a.addedAt;
    case 'author':
      return (a, b) => {
        if (!a.author !== !b.author) return a.author ? -1 : 1; // books without an author go last
        return collator.compare(a.author ?? '', b.author ?? '') || collator.compare(a.title, b.title);
      };
  }
}

/** The books to show, filtered and ordered. A search keeps its own best-match order. */
export function selectBooks(books: readonly StoredBook[], percents: ReadonlyMap<string, number>, options: ViewOptions): StoredBook[] {
  const { segment, chip, sort, searchIds, only } = options;
  const pass = (b: StoredBook): boolean => {
    if (only && !only.has(b.id)) return false;
    if (segment === 'audio' && b.kind !== 'audio') return false;
    if (segment === 'books' && b.kind === 'audio') return false;
    return chip === null || matchesChip(b, percents.get(b.id) ?? 0, chip);
  };
  if (searchIds) {
    const byId = new Map(books.map((b) => [b.id, b] as const));
    const out: StoredBook[] = [];
    for (const id of searchIds) {
      const b = byId.get(id);
      if (b && pass(b)) out.push(b);
    }
    return out;
  }
  return books.filter(pass).sort(compare(sort));
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
