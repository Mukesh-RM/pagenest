import type { BookFormat, BookKind } from '@/app/contracts';
import type { StoredBook } from '@/workers/import/protocol';

const KINDS: readonly BookKind[] = ['ebook', 'pdf', 'audio', 'doc'];

/**
 * A row from the `books` store, made safe to show. Rows can come from another tool or an older
 * version (they may lack a cover, fingerprint, dates or flags), so every field the screen needs
 * gets a sensible value and nothing throws.
 */
export function normalizeBook(row: Partial<StoredBook> & { id: string }): StoredBook {
  const kind = KINDS.includes(row.kind as BookKind) ? (row.kind as BookKind) : 'ebook';
  const title = typeof row.title === 'string' && row.title.trim() !== '' ? row.title : 'Untitled';
  const out: StoredBook = {
    ...(row as StoredBook),
    id: row.id,
    fingerprint: typeof row.fingerprint === 'string' ? row.fingerprint : row.id,
    kind,
    format: (row.format ? row.format : kind === 'audio' ? 'mp3' : 'epub') as BookFormat,
    title,
    addedAt: typeof row.addedAt === 'number' && Number.isFinite(row.addedAt) ? row.addedAt : 0,
    favorite: row.favorite === true,
    finished: row.finished === true,
  };
  return out;
}
