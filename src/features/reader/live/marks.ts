import type { TextRange } from '@/app/contracts';
import type { PageNestDB } from '@/data/db';
import { newId } from '@/data';
import type { BookmarkRecord, HighlightRecord } from '@/data/schema';
import type { HighlightColor, SearchHit } from '@/engines/reader/types';
import type { ReaderDocumentExt } from '../core/ext-types';

export async function loadHighlights(db: PageNestDB, bookId: string): Promise<HighlightRecord[]> {
  return db.highlights.where('bookId').equals(bookId).sortBy('createdAt');
}

export async function loadBookmarks(db: PageNestDB, bookId: string): Promise<BookmarkRecord[]> {
  return db.bookmarks.where('bookId').equals(bookId).sortBy('createdAt');
}

export function applyHighlights(doc: ReaderDocumentExt, rows: readonly HighlightRecord[]): void {
  for (const row of rows) doc.showHighlight(row.id, row.range, row.color);
}

export async function addHighlight(
  db: PageNestDB,
  bookId: string,
  doc: ReaderDocumentExt,
  range: TextRange,
  text: string,
  color: HighlightColor,
): Promise<HighlightRecord> {
  const row: HighlightRecord = { id: newId(), bookId, range, text, color, createdAt: Date.now() };
  await db.highlights.put(row);
  doc.showHighlight(row.id, range, color);
  doc.clearSelection();
  return row;
}

export async function setHighlightNote(db: PageNestDB, row: HighlightRecord, note: string): Promise<HighlightRecord> {
  const next = { ...row, note: note.trim() || undefined };
  await db.highlights.put(next);
  return next;
}

export async function addBookmark(
  db: PageNestDB,
  bookId: string,
  locator: BookmarkRecord['locator'],
  label: string,
): Promise<BookmarkRecord> {
  const row: BookmarkRecord = { id: newId(), bookId, locator, label, createdAt: Date.now() };
  await db.bookmarks.put(row);
  return row;
}

/** Collect search hits from the engine into a list (for the results sheet). */
export async function collectSearchHits(
  doc: ReaderDocumentExt,
  query: string,
  signal?: AbortSignal,
  limit = 80,
): Promise<SearchHit[]> {
  const hits: SearchHit[] = [];
  for await (const hit of doc.search(query, signal)) {
    hits.push(hit);
    if (hits.length >= limit) break;
  }
  return hits;
}
