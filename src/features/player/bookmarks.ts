import type { EntityId, Locator } from '@/app/contracts';
import type { PageNestDB } from '@/data/db';
import type { BookmarkRecord } from '@/data/schema';

export async function listBookmarks(db: PageNestDB, bookId: EntityId): Promise<BookmarkRecord[]> {
  return db.bookmarks.where('bookId').equals(bookId).sortBy('createdAt');
}

export async function addBookmark(
  db: PageNestDB,
  bookId: EntityId,
  locator: Locator,
  label: string,
): Promise<BookmarkRecord> {
  const record: BookmarkRecord = {
    id: crypto.randomUUID(),
    bookId,
    locator,
    label,
    createdAt: Date.now(),
  };
  await db.bookmarks.add(record);
  return record;
}

export async function removeBookmark(db: PageNestDB, id: EntityId): Promise<void> {
  await db.bookmarks.delete(id);
}
