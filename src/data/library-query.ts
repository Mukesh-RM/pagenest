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
 * hundred bytes each, so 5,000 books is about 1.5 MB) and keeps it current from Dexie's
 * `storagemutated` event, which also reports writes made by another worker or tab. Queries on
 * the snapshot take a few milliseconds; only the requested page is returned.
 *
 * Keeping it current is incremental: the event names the primary keys that were written, so only
 * those books are read again and patched into the snapshot and into the sorted lists already built
 * (see "Staying up to date" in docs/DATA_LAYER.md for the measurements). If a change cannot be
 * named (a first open, `clear()`, a very large batch) the whole table is read once instead.
 *
 * Meant to run in the data worker. It is plain, so tests and the in-process fallback use it directly.
 */
export class LibraryQueryService {
  private docs: IndexedBook[] = [];
  private readonly byId = new Map<string, IndexedBook>();
  /** The whole table must be read again. */
  private dirty = true;
  /** Books written since the snapshot was taken, by primary key; only these are read again. */
  private readonly pending = new Set<string>();
  private loading: Promise<void> | undefined;
  private readonly sortedCache = new Map<string, SortedList>();
  private readonly onMutated: (parts: Record<string, unknown>) => void;

  constructor(private readonly db: PageNestDB) {
    const prefix = `idb://${db.name}/books/`;
    this.onMutated = (parts) => {
      let touched = false;
      for (const key of Object.keys(parts)) {
        if (key.startsWith(prefix)) {
          touched = true;
          break;
        }
      }
      if (!touched) return;
      // The primary-key entry lists exactly the keys that were written or deleted.
      const keys = pointKeys(parts[prefix]);
      if (keys === undefined || this.pending.size + keys.length > MAX_PATCH) this.invalidate();
      else for (const key of keys) this.pending.add(key);
    };
    Dexie.on('storagemutated', this.onMutated as never);
  }

  /** Stop listening for database changes. */
  close(): void {
    Dexie.on('storagemutated').unsubscribe(this.onMutated as never);
  }

  /** Mark the whole snapshot out of date. Normally unnecessary: changes to `books` are noticed (and patched) for you. */
  invalidate(): void {
    this.dirty = true;
  }

  private async ensure(): Promise<void> {
    // Several callers share one refresh; a change that arrives during a refresh triggers another one.
    while (this.dirty || this.pending.size > 0 || this.loading) {
      this.loading ??= this.refresh().finally(() => {
        this.loading = undefined;
      });
      await this.loading;
    }
  }

  private async refresh(): Promise<void> {
    if (this.dirty) {
      this.dirty = false;
      this.pending.clear();
      const books = await this.db.books.toArray();
      this.byId.clear();
      for (const book of books) this.byId.set(book.id, indexBook(book));
      this.docs = [...this.byId.values()];
      this.sortedCache.clear();
      return;
    }
    const ids = [...this.pending];
    this.pending.clear();
    const rows = await this.db.books.bulkGet(ids);
    // Something we cannot patch happened meanwhile: the next round reads everything.
    if (this.dirty) return;
    const removed = new Set<string>();
    const added: IndexedBook[] = [];
    for (const [i, id] of ids.entries()) {
      const row = rows[i];
      if (row) {
        const doc = indexBook(row);
        this.byId.set(id, doc);
        added.push(doc);
      } else {
        this.byId.delete(id);
      }
      removed.add(id);
    }
    this.docs = [...this.byId.values()];
    for (const list of this.sortedCache.values()) patchSorted(list, removed, added);
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
    if (cached) return cached.items;
    const compare = comparators[sort === 'relevance' ? 'recent' : sort];
    const asc = [...this.docs].sort(compare);
    const list: SortedList = { compare: direction === 'asc' ? compare : (a, b) => compare(b, a), items: direction === 'asc' ? asc : asc.reverse() };
    this.sortedCache.set(key, list);
    return list.items;
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

/** More changed books than this in one go: read the whole table instead of looking each one up. */
const MAX_PATCH = 500;

/** A list kept in sort order, with the comparison that orders it (direction included). */
interface SortedList {
  readonly compare: (a: IndexedBook, b: IndexedBook) => number;
  items: IndexedBook[];
}

/**
 * The keys in a Dexie change set (`RangeSet`), when it names single keys only. `undefined` when it
 * covers a range (a first open or `clear()`), which cannot be turned into a list of books.
 * Works on the plain interval tree, so a set that came from another tab (already copied) is fine.
 */
function pointKeys(set: unknown): string[] | undefined {
  const keys: string[] = [];
  const walk = (node: unknown): boolean => {
    if (node === null || node === undefined) return true;
    const n = node as { from?: unknown; to?: unknown; l?: unknown; r?: unknown; d?: unknown };
    if (n.from === undefined && n.to === undefined) return n.d === 0; // empty set
    if (typeof n.from !== 'string' || n.from !== n.to) return false;
    keys.push(n.from);
    return walk(n.l) && walk(n.r);
  };
  return walk(set) ? keys : undefined;
}

/** Take the changed books out of a sorted list and put their new versions in at the right place. */
function patchSorted(list: SortedList, removed: ReadonlySet<string>, added: readonly IndexedBook[]): void {
  const items = list.items.filter((d) => !removed.has(d.book.id));
  for (const doc of added) {
    let lo = 0;
    let hi = items.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (list.compare(items[mid] as IndexedBook, doc) <= 0) lo = mid + 1;
      else hi = mid;
    }
    items.splice(lo, 0, doc);
  }
  list.items = items;
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
