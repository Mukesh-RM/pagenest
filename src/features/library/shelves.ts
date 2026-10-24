import { newId, type PageNestDB } from '@/data/db';
import type { CollectionRecord } from '@/data/schema';

/** Shelves (collections): plain database operations, with plain-words errors for names. */

export const MAX_SHELF_NAME = 60;

/** Returns a plain-words problem with a shelf name, or `undefined` when it is fine. */
export function shelfNameProblem(name: string, others: readonly CollectionRecord[], ignoreId?: string): string | undefined {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean === '') return 'Give the shelf a name.';
  if (clean.length > MAX_SHELF_NAME) return `Keep the name under ${MAX_SHELF_NAME} letters.`;
  const lower = clean.toLocaleLowerCase();
  if (others.some((s) => s.id !== ignoreId && s.name.toLocaleLowerCase() === lower)) return 'You already have a shelf with that name.';
  return undefined;
}

export async function listShelves(db: PageNestDB): Promise<CollectionRecord[]> {
  return db.collections.orderBy('order').toArray();
}

export async function createShelf(db: PageNestDB, name: string): Promise<CollectionRecord> {
  const shelves = await listShelves(db);
  const problem = shelfNameProblem(name, shelves);
  if (problem) throw new Error(problem);
  const order = shelves.reduce((m, s) => Math.max(m, s.order), -1) + 1;
  const shelf: CollectionRecord = { id: newId(), name: name.trim().replace(/\s+/g, ' '), order };
  await db.collections.add(shelf);
  return shelf;
}

export async function renameShelf(db: PageNestDB, id: string, name: string): Promise<void> {
  const shelves = await listShelves(db);
  const problem = shelfNameProblem(name, shelves, id);
  if (problem) throw new Error(problem);
  await db.collections.update(id, { name: name.trim().replace(/\s+/g, ' ') });
}

/** Remove a shelf (not its books). Returns what is needed to bring it back. */
export async function deleteShelf(db: PageNestDB, id: string): Promise<{ shelf: CollectionRecord; bookIds: string[] } | undefined> {
  return db.transaction('rw', db.collections, db.collectionBooks, async () => {
    const shelf = await db.collections.get(id);
    if (!shelf) return undefined;
    const links = await db.collectionBooks.where('collectionId').equals(id).toArray();
    await db.collectionBooks.bulkDelete(links.map((l) => [l.collectionId, l.bookId] as [string, string]));
    await db.collections.delete(id);
    return { shelf, bookIds: links.sort((a, b) => a.order - b.order).map((l) => l.bookId) };
  });
}

export async function restoreShelf(db: PageNestDB, shelf: CollectionRecord, bookIds: readonly string[]): Promise<void> {
  await db.transaction('rw', db.collections, db.collectionBooks, db.books, async () => {
    await db.collections.put(shelf);
    const present = new Set((await db.books.bulkGet([...bookIds])).filter((b) => b !== undefined).map((b) => b.id));
    await db.collectionBooks.bulkPut(bookIds.filter((b) => present.has(b)).map((bookId, order) => ({ collectionId: shelf.id, bookId, order })));
  });
}

/** Move a shelf one place up or down (the order is renumbered so it stays 0, 1, 2, ...). */
export async function moveShelf(db: PageNestDB, id: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.collections, async () => {
    const shelves = await listShelves(db);
    const from = shelves.findIndex((s) => s.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= shelves.length) return;
    const moved = shelves.splice(from, 1)[0] as CollectionRecord;
    shelves.splice(to, 0, moved);
    await db.collections.bulkPut(shelves.map((s, order) => ({ ...s, order })));
  });
}

export async function shelfBookIds(db: PageNestDB, shelfId: string): Promise<string[]> {
  const links = await db.collectionBooks.where('collectionId').equals(shelfId).toArray();
  return links.sort((a, b) => a.order - b.order).map((l) => l.bookId);
}

/** Put books on a shelf (already-there books stay where they are). */
export async function addToShelf(db: PageNestDB, shelfId: string, bookIds: readonly string[]): Promise<number> {
  return db.transaction('rw', db.collectionBooks, async () => {
    const links = await db.collectionBooks.where('collectionId').equals(shelfId).toArray();
    const have = new Set(links.map((l) => l.bookId));
    let order = links.reduce((m, l) => Math.max(m, l.order), -1) + 1;
    const fresh = bookIds.filter((id) => !have.has(id));
    await db.collectionBooks.bulkPut(fresh.map((bookId) => ({ collectionId: shelfId, bookId, order: order++ })));
    return fresh.length;
  });
}

export async function removeFromShelf(db: PageNestDB, shelfId: string, bookIds: readonly string[]): Promise<void> {
  await db.collectionBooks.bulkDelete(bookIds.map((b) => [shelfId, b] as [string, string]));
}

/** For each shelf id, how many of `bookIds` are on it. */
export async function shelfMembership(db: PageNestDB, bookIds: readonly string[]): Promise<Map<string, number>> {
  const want = new Set(bookIds);
  const counts = new Map<string, number>();
  await db.collectionBooks.each((l) => {
    if (want.has(l.bookId)) counts.set(l.collectionId, (counts.get(l.collectionId) ?? 0) + 1);
  });
  return counts;
}

/** Move a book up or down inside a shelf. */
export async function moveInShelf(db: PageNestDB, shelfId: string, bookId: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.collectionBooks, async () => {
    const ids = await shelfBookIds(db, shelfId);
    const from = ids.indexOf(bookId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    const [moved] = ids.splice(from, 1) as [string];
    ids.splice(to, 0, moved);
    await db.collectionBooks.bulkPut(ids.map((id, order) => ({ collectionId: shelfId, bookId: id, order })));
  });
}
