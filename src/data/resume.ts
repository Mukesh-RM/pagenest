import type { Locator } from '@/app/contracts';
import type { PageNestDB } from './db';
import type { BookRecord, ChapterRecord, ProgressRow } from './schema';

/** Everything the "Welcome back" card shows, and what a reader needs to land on the exact spot. */
export interface ResumeInfo {
  readonly bookId: string;
  readonly title: string;
  readonly author?: string;
  readonly mode: ProgressRow['mode'];
  /** Exact saved position. Hand this to the reader or player; it restores the same spot. */
  readonly locator: Locator;
  /** 0 to 100. */
  readonly percent: number;
  /** 1-based chapter number, when the book has chapter info that covers the position. */
  readonly chapterNumber?: number;
  readonly chapterTitle?: string;
  readonly updatedAt: number;
}

/**
 * The chapter that contains `locator`: the last chapter that starts at or before it.
 * Chapters without a start that can be compared with the position are ignored, so a book
 * with partial or no chapter info simply has no chapter (never a wrong one).
 */
export function chapterForLocator(chapters: readonly ChapterRecord[], locator: Locator): ChapterRecord | undefined {
  let best: ChapterRecord | undefined;
  for (const chapter of [...chapters].sort((a, b) => a.index - b.index)) {
    if (startsAtOrBefore(chapter, locator)) best = chapter;
  }
  return best;
}

function startsAtOrBefore(chapter: ChapterRecord, at: Locator): boolean {
  const start = chapter.locator;
  if (start && start.kind === at.kind) {
    switch (at.kind) {
      case 'reflow': {
        const s = start as typeof at;
        return s.section < at.section || (s.section === at.section && s.textOffset <= at.textOffset);
      }
      case 'page':
        return (start as typeof at).page <= at.page;
      case 'audio': {
        const s = start as typeof at;
        return s.trackIndex < at.trackIndex || (s.trackIndex === at.trackIndex && s.positionSec <= at.positionSec);
      }
    }
  }
  // One-file audiobooks (M4B) give chapter starts in seconds from the beginning.
  if (at.kind === 'audio' && at.trackIndex === 0 && typeof chapter.startSec === 'number') return chapter.startSec <= at.positionSec;
  return false;
}

/** Wording for the card title: "Welcome back, chapter 7", or just "Welcome back". */
export function resumeHeading(info: Pick<ResumeInfo, 'chapterNumber'>): string {
  return info.chapterNumber === undefined ? 'Welcome back' : `Welcome back, chapter ${info.chapterNumber}`;
}

/**
 * Choose what to resume from the saved positions, newest first: the most recently saved
 * position of a book that still exists and is not finished (below 100 %, not marked finished).
 */
export function pickResume(
  rows: readonly ProgressRow[],
  books: ReadonlyMap<string, BookRecord>,
  chaptersOf: (bookId: string) => readonly ChapterRecord[],
): ResumeInfo | undefined {
  for (const row of [...rows].sort((a, b) => b.updatedAt - a.updatedAt)) {
    const book = books.get(row.bookId);
    if (!book || book.finished || row.percent >= 100) continue;
    const chapter = chapterForLocator(chaptersOf(row.bookId), row.locator);
    return {
      bookId: book.id,
      title: book.title,
      ...(book.author ? { author: book.author } : {}),
      mode: row.mode,
      locator: row.locator,
      percent: row.percent,
      ...(chapter ? { chapterNumber: chapter.index + 1, chapterTitle: chapter.title } : {}),
      updatedAt: row.updatedAt,
    };
  }
  return undefined;
}

/** How many of the newest saved positions are looked at before giving up (skips finished and deleted books). */
const CANDIDATES = 12;

/** Load the resume info from IndexedDB, reading only a handful of rows. `undefined` when there is nothing to resume. */
export async function loadResume(db: PageNestDB): Promise<ResumeInfo | undefined> {
  const rows = await db.progress.orderBy('updatedAt').reverse().limit(CANDIDATES).toArray();
  if (rows.length === 0) return undefined;
  const bookIds = [...new Set(rows.map((r) => r.bookId))];
  const found = await db.books.bulkGet(bookIds);
  const books = new Map<string, BookRecord>();
  for (const b of found) if (b) books.set(b.id, b);
  // Chapters only for the book that will be chosen.
  const first = rows.find((r) => {
    const b = books.get(r.bookId);
    return b && !b.finished && r.percent < 100;
  });
  const chapters = first ? await db.chapters.where('bookId').equals(first.bookId).toArray() : [];
  return pickResume(rows, books, () => chapters);
}
