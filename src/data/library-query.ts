import Dexie from 'dexie';
import type { PageNestDB } from './db';
import { compareText, indexBook, scoreBook, searchTerms, type IndexedBook } from './library-index';
import type { BookRecord, ProgressRow } from './schema';

/** Which books: everything, e-books/PDFs/documents, or audiobooks (the All, Books, Audio control). */
export type LibrarySegment = 'all' | 'books' | 'audio';

/** The filter chips. */
export type LibraryStatus = 'reading' | 'listening' | 'finished' | 'unfinished' | 'favorites';

/** `relevance` is for searches; `shelf` is the order inside a collection. */
export type LibrarySort = 'recent' | 'added' | 'title' | 'author' | 'relevance' | 'shelf';

export interface LibraryQuery {
  /** Search box text. Every word must match the title, author, narrator or series. */
  readonly text?: string;
  readonly segment?: LibrarySegment;
  readonly status?: LibraryStatus;
  /** Only books on this shelf. */
  readonly collectionId?: string;
  /**
   * Default: `relevance` when `text` is given, `shelf` inside a collection, otherwise `recent`.
   * `recent` is last opened (books never opened last, newest added first among them).
   */
  readonly sort?: LibrarySort;
  /** Default: the natural direction of the sort (`recent` and `added` newest first, `title` and `author` A to Z). */
  readonly direction?: 'asc' | 'desc';
  readonly offset?: number;
  /** Default 60, at most 500. */
  readonly limit?: number;
}

/** A book plus how far along the person is, so a grid needs no second query. */
export interface BookSummary extends BookRecord {
  /** 0 to 100: the furthest position across reading, listening and read-aloud. */
  readonly percent: number;
}

export interface LibraryPage {
  /** Number of books matching, before paging. */
  readonly total: number;
  readonly items: BookSummary[];
}

export const DEFAULT_PAGE_SIZE = 60;
export const MAX_PAGE_SIZE = 500;

const NATURAL_DIRECTION: Record<LibrarySort, 'asc' | 'desc'> = {
  recent: 'desc',
  added: 'desc',
  title: 'asc',
  author: 'asc',
  relevance: 'desc',
  shelf: 'asc',
};

/**
 * Search, filter, sort and page the library. Keeps a snapshot of all books in memory (a few
 * hundred bytes each, so 5,000 books is about 1.5 MB) and rebuilds it lazily after any change to
 * the `books` table, including changes made by another worker or tab (Dexie's `storagemutated`
 * event). Queries on the snapshot take a few milliseconds; only the requested page is returned.
 *
 * Meant to run in the data worker. It is plain, so tests and the in-process fallback use it directly.
 */
export class LibraryQueryService {
  private docs: IndexedBook[] = [];
  private dirty = true;
  private loading: Promise<void> | undefined;
  private readonly sortedCache = new Map<string, readonly IndexedBook[]>();
  private readonly onMutated: (parts: Record<string, unknown>) => void;

  constructor(private readonly db: PageNestDB) {
    const prefix = `idb://${db.name}/books/`;
    this.onMutated = (parts) => {
      for (const key of Object.keys(parts)) {
        if (key.startsWith(prefix)) {
          this.invalidate();
          return;
        }
      }
    };
    Dexie.on('storagemutated', this.onMutated as never);
  }

  /** Stop listening for database changes. */
  close(): void {
    Dexie.on('storagemutated').unsubscribe(this.onMutated as never);
  }

  /** Mark the snapshot out of date. Called for you on any change to `books`. */
  invalidate(): void {
    this.dirty = true;
  }

  private async ensure(): Promise<void> {
    // Several callers share one load; a change that arrives during a load triggers another one.
    while (this.dirty || this.loading) {
      this.loading ??= (async () => {
        this.dirty = false;
        const books = await this.db.books.toArray();
        this.docs = books.map(indexBook);
        this.sortedCache.clear();
      })().finally(() => {
        this.loading = undefined;
      });
      await this.loading;
    }
  }

  /** Number of books in the library. */
  async count(): Promise<number> {
    await this.ensure();
    return this.docs.length;
  }

  async query(q: LibraryQuery = {}): Promise<LibraryPage> {
    await this.ensure();
    const terms = searchTerms(q.text ?? '');
    const sort: LibrarySort = q.sort ?? (terms.length > 0 ? 'relevance' : q.collectionId ? 'shelf' : 'recent');
    const direction = q.direction ?? NATURAL_DIRECTION[sort];

    // Data needed only by some filters is read only when asked for.
    const progress = q.status === 'reading' || q.status === 'listening' ? await this.db.progress.toArray() : undefined;
    const shelf = q.collectionId ? await this.shelfOrder(q.collectionId) : undefined;

    const engaged = progress ? engagedBooks(progress, q.status === 'listening' ? ['listen'] : ['read', 'aloud']) : undefined;
    const matches = (doc: IndexedBook): boolean => {
      const b = doc.book;
      if (q.segment === 'books' && b.kind === 'audio') return false;
      if (q.segment === 'audio' && b.kind !== 'audio') return false;
      if (shelf && !shelf.has(b.id)) return false;
      switch (q.status) {
        case 'finished':
          return b.finished;
        case 'unfinished':
          return !b.finished;
        case 'favorites':
          return b.favorite;
        case 'reading':
        case 'listening':
          return !b.finished && (engaged?.has(b.id) ?? false);
        default:
          return true;
      }
    };

    let found: IndexedBook[];
    if (terms.length > 0) {
      const scored: { doc: IndexedBook; score: number }[] = [];
      for (const doc of this.docs) {
        if (!matches(doc)) continue;
        const score = scoreBook(doc, terms);
        if (score > 0) scored.push({ doc, score });
      }
      if (sort === 'relevance') {
        scored.sort((a, b) => b.score - a.score || compareText(a.doc.book.title, b.doc.book.title));
        if (direction === 'asc') scored.reverse();
        found = scored.map((s) => s.doc);
      } else {
        const keep = new Set(scored.map((s) => s.doc.book.id));
        found = this.sorted(sort, direction, shelf).filter((d) => keep.has(d.book.id));
      }
    } else {
      found = this.sorted(sort === 'relevance' ? 'recent' : sort, direction, shelf).filter(matches);
    }

    const offset = Math.max(0, Math.floor(q.offset ?? 0));
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(q.limit ?? DEFAULT_PAGE_SIZE)));
    const page = found.slice(offset, offset + limit);
    const percents = await this.percents(page.map((d) => d.book.id));
    return {
      total: found.length,
      items: page.map((d) => ({ ...d.book, percent: percents.get(d.book.id) ?? 0 })),
    };
  }

  /** Book ids on a shelf, in shelf order, as a Map from id to position. */
  private async shelfOrder(collectionId: string): Promise<Map<string, number>> {
    const links = await this.db.collectionBooks.where('collectionId').equals(collectionId).toArray();
    links.sort((a, b) => a.order - b.order);
    return new Map(links.map((l, i) => [l.bookId, i]));
  }

  private sorted(sort: LibrarySort, direction: 'asc' | 'desc', shelf: Map<string, number> | undefined): readonly IndexedBook[] {
    if (sort === 'shelf') {
      const order = shelf ?? new Map<string, number>();
      const list = this.docs.filter((d) => order.has(d.book.id)).sort((a, b) => (order.get(a.book.id) ?? 0) - (order.get(b.book.id) ?? 0));
      return direction === 'asc' ? list : list.reverse();
    }
    const key = `${sort}:${direction}`;
    const cached = this.sortedCache.get(key);
    if (cached) return cached;
    const asc = [...this.docs].sort(comparators[sort === 'relevance' ? 'recent' : sort]);
    const result = direction === 'asc' ? asc : asc.reverse();
    this.sortedCache.set(key, result);
    return result;
  }

  /** Progress for just these books (one indexed read, not the whole table). */
  private async percents(ids: readonly string[]): Promise<Map<string, number>> {
    const best = new Map<string, number>();
    if (ids.length === 0) return best;
    const rows = await this.db.progress.where('bookId').anyOf(ids as string[]).toArray();
    for (const r of rows) best.set(r.bookId, Math.max(best.get(r.bookId) ?? 0, r.percent));
    return best;
  }
}

function engagedBooks(rows: readonly ProgressRow[], modes: readonly string[]): Set<string> {
  const ids = new Set<string>();
  for (const r of rows) if (modes.includes(r.mode) && r.percent > 0) ids.add(r.bookId);
  return ids;
}

/** Ascending comparators. `recent` ascending is oldest opened first, never-opened books first. */
const comparators: Record<Exclude<LibrarySort, 'relevance' | 'shelf'>, (a: IndexedBook, b: IndexedBook) => number> = {
  recent: (a, b) =>
    (a.book.lastOpenedAt ?? -1) - (b.book.lastOpenedAt ?? -1) || a.book.addedAt - b.book.addedAt || compareText(a.book.title, b.book.title),
  added: (a, b) => a.book.addedAt - b.book.addedAt || compareText(a.book.title, b.book.title),
  title: (a, b) => compareText(a.book.title, b.book.title) || a.book.addedAt - b.book.addedAt,
  author: (a, b) => {
    // Books without an author sort after the others in A to Z order.
    const aa = a.book.author ?? '';
    const ba = b.book.author ?? '';
    if (aa === '' && ba !== '') return 1;
    if (ba === '' && aa !== '') return -1;
    return compareText(aa, ba) || compareText(a.book.title, b.book.title);
  },
};
