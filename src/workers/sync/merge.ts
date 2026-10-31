import type { BookRepository } from '@/data/books';
import type { CollectionRepository } from '@/data/collections';
import type { PageNestDB } from '@/data/db';
import type {
  BookmarkRecord,
  BookRecord,
  CollectionBookRecord,
  CollectionRecord,
  HighlightRecord,
  ProgressRow,
  SessionRecord,
  SettingRecord,
} from '@/data/schema';
import type { SettingSyncRow } from './payload';
import { SYNC_DATA_STORES, type SyncPayload } from './payload';

export interface SyncMergeSummary {
  booksMatched: number;
  booksUpdated: number;
  progressMerged: number;
  bookmarksMerged: number;
  highlightsMerged: number;
  collectionsMerged: number;
  settingsMerged: number;
  sessionsMerged: number;
}

export interface SyncMergeDeps {
  db: PageNestDB;
  books: BookRepository;
  collections: CollectionRepository;
}

const CHUNK = 400;

async function putAll(db: PageNestDB, store: (typeof SYNC_DATA_STORES)[number], rows: unknown[]): Promise<void> {
  const table = db.table(store);
  for (let i = 0; i < rows.length; i += CHUNK) {
    await table.bulkPut(rows.slice(i, i + CHUNK));
    await new Promise((r) => setTimeout(r, 0));
  }
}

function rowVersion(record: Record<string, unknown>): number {
  for (const key of ['updatedAt', 'lastOpenedAt', 'createdAt', 'addedAt', 'startedAt'] as const) {
    const v = record[key];
    if (typeof v === 'number') return v;
  }
  return 0;
}

function rangesOverlap(a: HighlightRecord, b: HighlightRecord): boolean {
  if (a.bookId !== b.bookId) return false;
  return JSON.stringify(a.range) === JSON.stringify(b.range);
}

/** Last-write-wins per item; highlights with the same id merge as one row, overlapping ranges stay separate. */
export async function mergeSyncPayload(payload: SyncPayload, deps: SyncMergeDeps): Promise<SyncMergeSummary> {
  const { db, books, collections } = deps;
  const summary: SyncMergeSummary = {
    booksMatched: 0,
    booksUpdated: 0,
    progressMerged: 0,
    bookmarksMerged: 0,
    highlightsMerged: 0,
    collectionsMerged: 0,
    settingsMerged: 0,
    sessionsMerged: 0,
  };

  const remoteBooks = (payload.data.books ?? []) as BookRecord[];
  const idMap = new Map<string, string>();

  for (const remote of remoteBooks) {
    const fingerprint = remote.fingerprint || remote.id;
    const local = await books.findByFingerprint(fingerprint);
    if (!local) continue;
    idMap.set(remote.id, local.id);
    summary.booksMatched += 1;
    const patch: Partial<BookRecord> = {};
    if (remote.lastOpenedAt !== undefined && (local.lastOpenedAt ?? 0) < remote.lastOpenedAt) {
      patch.lastOpenedAt = remote.lastOpenedAt;
    }
    if (remote.favorite !== local.favorite && payload.exportedAt >= (local.addedAt ?? 0)) {
      patch.favorite = remote.favorite;
    }
    if (remote.finished !== local.finished && payload.exportedAt >= (local.addedAt ?? 0)) {
      patch.finished = remote.finished;
    }
    if (Object.keys(patch).length > 0) {
      await books.update(local.id, patch);
      summary.booksUpdated += 1;
    }
  }

  const remapBook = (bookId: string): string | undefined => idMap.get(bookId);

  for (const row of (payload.data.progress ?? []) as ProgressRow[]) {
    const bookId = remapBook(row.bookId);
    if (!bookId) continue;
    const current = await db.progress.get([bookId, row.mode]);
    if (!current || current.updatedAt < row.updatedAt) {
      await db.progress.put({ ...row, bookId });
      summary.progressMerged += 1;
    }
  }

  for (const row of (payload.data.bookmarks ?? []) as BookmarkRecord[]) {
    const bookId = remapBook(row.bookId);
    if (!bookId) continue;
    const current = await db.bookmarks.get(row.id);
    if (!current || rowVersion(current as unknown as Record<string, unknown>) <= rowVersion(row as unknown as Record<string, unknown>)) {
      await db.bookmarks.put({ ...row, bookId });
      summary.bookmarksMerged += 1;
    }
  }

  const localHighlights = new Map<string, HighlightRecord>();
  for (const id of idMap.values()) {
    for (const h of await db.highlights.where('bookId').equals(id).toArray()) {
      localHighlights.set(h.id, h);
    }
  }
  for (const row of (payload.data.highlights ?? []) as HighlightRecord[]) {
    const bookId = remapBook(row.bookId);
    if (!bookId) continue;
    const next = { ...row, bookId };
    const current = localHighlights.get(row.id);
    if (current) {
      if (rowVersion(current as unknown as Record<string, unknown>) > rowVersion(next as unknown as Record<string, unknown>)) continue;
      if (current.note && next.note && current.note !== next.note && rowVersion(next as unknown as Record<string, unknown>) >= rowVersion(current as unknown as Record<string, unknown>)) {
        next.note = `${next.note}\n\n—\n${current.note}`;
      }
      await db.highlights.put(next);
      localHighlights.set(row.id, next);
      summary.highlightsMerged += 1;
      continue;
    }
    await db.highlights.put(next);
    localHighlights.set(row.id, next);
    summary.highlightsMerged += 1;
  }

  const sessionOut: SessionRecord[] = [];
  for (const row of (payload.data.sessions ?? []) as SessionRecord[]) {
    const bookId = remapBook(row.bookId);
    if (!bookId) continue;
    const current = await db.sessions.get(row.id);
    if (!current || rowVersion(current as unknown as Record<string, unknown>) <= rowVersion(row as unknown as Record<string, unknown>)) {
      sessionOut.push({ ...row, bookId });
    }
  }
  if (sessionOut.length > 0) {
    await putAll(db, 'sessions', sessionOut);
    summary.sessionsMerged += sessionOut.length;
  }

  const shelves = ((payload.data.collections ?? []) as CollectionRecord[]).slice().sort((a, b) => a.order - b.order);
  const links = (payload.data.collectionBooks ?? []) as CollectionBookRecord[];
  for (const shelf of shelves) {
    const current = await collections.list();
    const wanted = shelf.name.trim().toLocaleLowerCase();
    const target = current.find((c) => c.name.trim().toLocaleLowerCase() === wanted) ?? (await collections.create(shelf.name));
    const ids = links
      .filter((l) => l.collectionId === shelf.id)
      .sort((a, b) => a.order - b.order)
      .map((l) => remapBook(l.bookId))
      .filter((id): id is string => id !== undefined);
    if (ids.length > 0) {
      await collections.addBooks(target.id, ids);
      summary.collectionsMerged += 1;
    }
  }

  for (const row of (payload.data.settings ?? []) as SettingSyncRow[]) {
    const current = (await db.settings.get(row.key)) as SettingSyncRow | undefined;
    const currentAt = current && typeof current.updatedAt === 'number' ? current.updatedAt : 0;
    if (!current || currentAt < row.updatedAt) {
      await db.settings.put({ key: row.key, value: row.value, updatedAt: row.updatedAt } as SettingRecord & { updatedAt: number });
      summary.settingsMerged += 1;
    }
  }

  return summary;
}

/** True when incoming highlight can be stored without dropping an overlapping local highlight. */
export function highlightsConflictSafe(local: HighlightRecord[], incoming: HighlightRecord): boolean {
  const existing = local.find((h) => h.id === incoming.id);
  if (existing) return true;
  return !local.some((h) => h.bookId === incoming.bookId && rangesOverlap(h, incoming));
}
