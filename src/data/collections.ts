import { newId, type PageNestDB } from './db';
import { normalizeText } from './library-index';
import type { BookRecord, CollectionRecord } from './schema';

/**
 * Shelves (blueprint 5.6, "Collections"): create, rename, reorder and delete shelves, put books
 * on them, take books off, and order the books on a shelf. Deleting a shelf never deletes books.
 * Plain data in and out, so it can sit behind `serveRpc`.
 */

export const MAX_SHELF_NAME_LENGTH = 60;

export type CollectionErrorCode = 'invalid-name' | 'duplicate-name' | 'not-found';

export class CollectionError extends Error {
  readonly code: CollectionErrorCode;
  constructor(code: CollectionErrorCode, message: string) {
    super(message);
    this.name = 'CollectionError';
    this.code = code;
  }
}

/** A shelf with the number of books on it. */
export interface CollectionSummary extends CollectionRecord {
  readonly bookCount: number;
}

export interface AddBooksResult {
  /** Books put on the shelf now. */
  readonly added: string[];
  /** Books that were already on it. */
  readonly alreadyThere: string[];
  /** Ids that are not in the library. */
  readonly unknown: string[];
}

export class CollectionRepository {
  constructor(private readonly db: PageNestDB) {}

  /** All shelves in shelf order, each with its book count (one pass over the link index, not one query per shelf). */
  async list(): Promise<CollectionSummary[]> {
    const [shelves, linkKeys] = await Promise.all([
      this.db.collections.orderBy('order').toArray(),
      this.db.collectionBooks.orderBy('collectionId').keys(),
    ]);
    const counts = new Map<string, number>();
    for (const key of linkKeys) counts.set(String(key), (counts.get(String(key)) ?? 0) + 1);
    return shelves.map((s) => ({ ...s, bookCount: counts.get(s.id) ?? 0 }));
  }

  async get(id: string): Promise<CollectionRecord | undefined> {
    return this.db.collections.get(id);
  }

  /**
   * Make a shelf at the end. Names are trimmed, 1 to 60 characters, and unique ignoring case and accents.
   * @throws CollectionError `invalid-name` or `duplicate-name`.
   */
  async create(name: string): Promise<CollectionRecord> {
    const clean = this.validName(name);
    return this.db.transaction('rw', this.db.collections, async () => {
      await this.assertUnique(clean);
      const last = await this.db.collections.orderBy('order').last();
      const shelf: CollectionRecord = { id: newId(), name: clean, order: (last?.order ?? -1) + 1 };
      await this.db.collections.add(shelf);
      return shelf;
    });
  }

  /** @throws CollectionError `not-found`, `invalid-name` or `duplicate-name`. */
  async rename(id: string, name: string): Promise<CollectionRecord> {
    const clean = this.validName(name);
    return this.db.transaction('rw', this.db.collections, async () => {
      const shelf = await this.db.collections.get(id);
      if (!shelf) throw new CollectionError('not-found', 'That shelf no longer exists.');
      await this.assertUnique(clean, id);
      const next = { ...shelf, name: clean };
      await this.db.collections.put(next);
      return next;
    });
  }

  /** Delete the shelf and its links. The books stay in the library. Returns false for an unknown shelf. */
  async remove(id: string): Promise<boolean> {
    return this.db.transaction('rw', this.db.collections, this.db.collectionBooks, async () => {
      const existed = (await this.db.collections.get(id)) !== undefined;
      await this.db.collectionBooks.where('collectionId').equals(id).delete();
      await this.db.collections.delete(id);
      return existed;
    });
  }

  /**
   * Put shelves in this order (drag to reorder). Ids not listed keep their relative order after the listed ones;
   * unknown ids are ignored. Positions are renumbered 0, 1, 2, ...
   */
  async reorder(orderedIds: readonly string[]): Promise<CollectionRecord[]> {
    return this.db.transaction('rw', this.db.collections, async () => {
      const all = await this.db.collections.orderBy('order').toArray();
      const byId = new Map(all.map((s) => [s.id, s]));
      const listed = [...new Set(orderedIds)].map((id) => byId.get(id)).filter((s): s is CollectionRecord => s !== undefined);
      const listedIds = new Set(listed.map((s) => s.id));
      const next = [...listed, ...all.filter((s) => !listedIds.has(s.id))].map((s, order) => ({ ...s, order }));
      await this.db.collections.bulkPut(next);
      return next;
    });
  }

  /**
   * Put books at the end of a shelf. Books already there keep their place; ids that are not in the library are reported, not stored.
   * @throws CollectionError `not-found` when the shelf does not exist.
   */
  async addBooks(collectionId: string, bookIds: readonly string[]): Promise<AddBooksResult> {
    return this.db.transaction('rw', this.db.collections, this.db.collectionBooks, this.db.books, async () => {
      if (!(await this.db.collections.get(collectionId))) throw new CollectionError('not-found', 'That shelf no longer exists.');
      const wanted = [...new Set(bookIds)];
      const present = await this.db.books.bulkGet(wanted);
      const links = await this.db.collectionBooks.where('collectionId').equals(collectionId).toArray();
      const there = new Set(links.map((l) => l.bookId));
      let order = links.reduce((max, l) => Math.max(max, l.order), -1) + 1;
      const result: { added: string[]; alreadyThere: string[]; unknown: string[] } = { added: [], alreadyThere: [], unknown: [] };
      const rows = [];
      for (const [i, id] of wanted.entries()) {
        if (!present[i]) result.unknown.push(id);
        else if (there.has(id)) result.alreadyThere.push(id);
        else {
          rows.push({ collectionId, bookId: id, order: order++ });
          result.added.push(id);
        }
      }
      if (rows.length > 0) await this.db.collectionBooks.bulkAdd(rows);
      return result;
    });
  }

  /** Take books off a shelf (they stay in the library). Remaining books are renumbered without gaps. Returns how many were removed. */
  async removeBooks(collectionId: string, bookIds: readonly string[]): Promise<number> {
    return this.db.transaction('rw', this.db.collectionBooks, async () => {
      const drop = new Set(bookIds);
      const links = await this.db.collectionBooks.where('collectionId').equals(collectionId).toArray();
      const gone = links.filter((l) => drop.has(l.bookId));
      if (gone.length === 0) return 0;
      await this.db.collectionBooks.bulkDelete(gone.map((l) => [l.collectionId, l.bookId] as [string, string]));
      const rest = links.filter((l) => !drop.has(l.bookId)).sort((a, b) => a.order - b.order);
      await this.db.collectionBooks.bulkPut(rest.map((l, order) => ({ ...l, order })));
      return gone.length;
    });
  }

  /** Put the books of a shelf in this order. Books not listed keep their relative order after the listed ones; ids not on the shelf are ignored. */
  async reorderBooks(collectionId: string, orderedBookIds: readonly string[]): Promise<void> {
    await this.db.transaction('rw', this.db.collectionBooks, async () => {
      const links = (await this.db.collectionBooks.where('collectionId').equals(collectionId).toArray()).sort((a, b) => a.order - b.order);
      const byBook = new Map(links.map((l) => [l.bookId, l]));
      const listed = [...new Set(orderedBookIds)].map((id) => byBook.get(id)).filter((l) => l !== undefined);
      const listedIds = new Set(listed.map((l) => l.bookId));
      const next = [...listed, ...links.filter((l) => !listedIds.has(l.bookId))].map((l, order) => ({ ...l, order }));
      await this.db.collectionBooks.bulkPut(next);
    });
  }

  /** The books on a shelf, in shelf order. (For a paged, searchable view use `LibraryQueryService` with `collectionId`.) */
  async booksIn(collectionId: string): Promise<BookRecord[]> {
    const links = (await this.db.collectionBooks.where('collectionId').equals(collectionId).toArray()).sort((a, b) => a.order - b.order);
    const books = await this.db.books.bulkGet(links.map((l) => l.bookId));
    return books.filter((b): b is BookRecord => b !== undefined);
  }

  /** The shelves a book is on, in shelf order (for the "add to collection" sheet's check marks). */
  async shelvesOf(bookId: string): Promise<CollectionRecord[]> {
    const links = await this.db.collectionBooks.where('bookId').equals(bookId).toArray();
    const shelves = await this.db.collections.bulkGet(links.map((l) => l.collectionId));
    return shelves.filter((s): s is CollectionRecord => s !== undefined).sort((a, b) => a.order - b.order);
  }

  private validName(name: string): string {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (clean === '') throw new CollectionError('invalid-name', 'Give the shelf a name.');
    if (clean.length > MAX_SHELF_NAME_LENGTH) {
      throw new CollectionError('invalid-name', `Shelf names can be up to ${MAX_SHELF_NAME_LENGTH} characters.`);
    }
    return clean;
  }

  private async assertUnique(clean: string, exceptId?: string): Promise<void> {
    const key = normalizeText(clean);
    const all = await this.db.collections.toArray();
    if (all.some((s) => s.id !== exceptId && normalizeText(s.name) === key)) {
      throw new CollectionError('duplicate-name', 'You already have a shelf with that name.');
    }
  }
}
