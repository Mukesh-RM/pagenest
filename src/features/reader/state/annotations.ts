import { newId, type PageNestDB } from '@/data/db';
import type { BookmarkRecord, HighlightRecord } from '@/data/schema';
import type { EntityId, Locator, TextRange } from '@/app/contracts';
import type { HighlightColor } from '@/engines/reader/types';
import { compareRanges, isTextRange } from '../core/ranges';

/** Highlights of one book in reading order. Damaged rows are skipped. */
export async function listHighlights(db: PageNestDB, bookId: EntityId): Promise<HighlightRecord[]> {
  const rows = await db.highlights.where('bookId').equals(bookId).toArray();
  return rows.filter((r) => isTextRange(r.range)).sort((a, b) => compareRanges(a.range, b.range) || a.createdAt - b.createdAt);
}

export async function addHighlight(
  db: PageNestDB,
  input: { bookId: EntityId; range: TextRange; text: string; color: HighlightColor; note?: string },
): Promise<HighlightRecord> {
  const row: HighlightRecord = {
    id: newId(),
    bookId: input.bookId,
    range: input.range,
    text: input.text.slice(0, 2000),
    color: input.color,
    ...(input.note ? { note: input.note } : {}),
    createdAt: Date.now(),
  };
  await db.highlights.add(row);
  return row;
}

export async function updateHighlight(db: PageNestDB, id: EntityId, patch: { color?: HighlightColor; note?: string }): Promise<HighlightRecord | undefined> {
  const row = await db.highlights.get(id);
  if (!row) return undefined;
  const next: HighlightRecord = { ...row, ...(patch.color ? { color: patch.color } : {}) };
  if (patch.note !== undefined) {
    const note = patch.note.trim();
    if (note) next.note = note;
    else delete next.note;
  }
  await db.highlights.put(next);
  return next;
}

export async function removeHighlight(db: PageNestDB, id: EntityId): Promise<void> {
  await db.highlights.delete(id);
}

/** Bookmarks of one book, newest first. */
export async function listBookmarks(db: PageNestDB, bookId: EntityId): Promise<BookmarkRecord[]> {
  const rows = await db.bookmarks.where('bookId').equals(bookId).toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function addBookmark(db: PageNestDB, input: { bookId: EntityId; locator: Locator; label: string }): Promise<BookmarkRecord> {
  const row: BookmarkRecord = { id: newId(), bookId: input.bookId, locator: input.locator, label: input.label.slice(0, 200), createdAt: Date.now() };
  await db.bookmarks.add(row);
  return row;
}

export async function removeBookmark(db: PageNestDB, id: EntityId): Promise<void> {
  await db.bookmarks.delete(id);
}

/**
 * Is `locator` on the page the reader shows? A PDF bookmark matches its page; a reflow bookmark matches when it sits in
 * the same section and within `window` characters of the current text position (re-pagination changes pages, not text).
 */
export function bookmarkIsHere(bookmark: Locator, here: Locator, window = 1200): boolean {
  if (bookmark.kind === 'page' && here.kind === 'page') return bookmark.page === here.page;
  if (bookmark.kind === 'reflow' && here.kind === 'reflow') {
    return bookmark.section === here.section && Math.abs(bookmark.textOffset - here.textOffset) <= window;
  }
  return false;
}
