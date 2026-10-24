import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Locator } from '@/app/contracts';
import { PageNestDB } from './db';
import { DexieProgressService } from './progress-service';
import { chapterForLocator, loadBookPosition, loadResume, pickResume, resumeHeading } from './resume';
import type { BookRecord, ChapterRecord, ProgressRow } from './schema';

const reflow = (section: number, textOffset = 0): Locator => ({ kind: 'reflow', section, textOffset });
const chapter = (index: number, title: string, rest: Partial<ChapterRecord> = {}): ChapterRecord => ({ bookId: 'b1', index, title, ...rest });

function book(id: string, rest: Partial<BookRecord> = {}): BookRecord {
  return { id, fingerprint: `fp-${id}`, kind: 'ebook', format: 'epub', title: `Title ${id}`, addedAt: 1, favorite: false, finished: false, ...rest };
}
function row(bookId: string, updatedAt: number, rest: Partial<ProgressRow> = {}): ProgressRow {
  return { bookId, mode: 'read', locator: reflow(0), percent: 10, updatedAt, ...rest };
}

describe('chapterForLocator', () => {
  const chapters = [
    chapter(0, 'Cover', { locator: reflow(0) }),
    chapter(1, 'One', { locator: reflow(1) }),
    chapter(2, 'Two', { locator: reflow(2, 500) }),
  ];

  it('picks the last chapter that starts at or before the position', () => {
    expect(chapterForLocator(chapters, reflow(1, 40))?.title).toBe('One');
    expect(chapterForLocator(chapters, reflow(2, 499))?.title).toBe('One');
    expect(chapterForLocator(chapters, reflow(2, 500))?.title).toBe('Two');
    expect(chapterForLocator(chapters, reflow(9))?.title).toBe('Two');
  });

  it('does not depend on the order chapters are given in', () => {
    expect(chapterForLocator([...chapters].reverse(), reflow(1))?.title).toBe('One');
  });

  it('works for PDF pages', () => {
    const pdf = [chapter(0, 'Intro', { locator: { kind: 'page', page: 1, offset: 0 } }), chapter(1, 'Part II', { locator: { kind: 'page', page: 30, offset: 0 } })];
    expect(chapterForLocator(pdf, { kind: 'page', page: 29, offset: 0.5 })?.title).toBe('Intro');
    expect(chapterForLocator(pdf, { kind: 'page', page: 30, offset: 0 })?.title).toBe('Part II');
  });

  it('works for audio chapters given as seconds in a one-file audiobook', () => {
    const audio = [chapter(0, 'Opening', { startSec: 0 }), chapter(1, 'Middle', { startSec: 600 })];
    expect(chapterForLocator(audio, { kind: 'audio', trackIndex: 0, positionSec: 599 })?.title).toBe('Opening');
    expect(chapterForLocator(audio, { kind: 'audio', trackIndex: 0, positionSec: 601 })?.title).toBe('Middle');
  });

  it('works for audio chapters that are tracks', () => {
    const tracks = [
      chapter(0, 'Track one', { locator: { kind: 'audio', trackIndex: 0, positionSec: 0 } }),
      chapter(1, 'Track two', { locator: { kind: 'audio', trackIndex: 1, positionSec: 0 } }),
    ];
    expect(chapterForLocator(tracks, { kind: 'audio', trackIndex: 1, positionSec: 12 })?.title).toBe('Track two');
  });

  it('returns nothing, never a wrong chapter, when chapter info does not apply', () => {
    expect(chapterForLocator([], reflow(3))).toBeUndefined();
    expect(chapterForLocator([chapter(0, 'No start')], reflow(3))).toBeUndefined();
    expect(chapterForLocator(chapters, { kind: 'page', page: 3, offset: 0 })).toBeUndefined();
    expect(chapterForLocator([chapter(0, 'Seconds', { startSec: 0 })], { kind: 'audio', trackIndex: 2, positionSec: 5 })).toBeUndefined();
  });
});

describe('resumeHeading', () => {
  it('names the chapter number when known', () => {
    expect(resumeHeading({ chapterNumber: 7 })).toBe('Welcome back, chapter 7');
    expect(resumeHeading({})).toBe('Welcome back');
  });
});

describe('pickResume', () => {
  const books = new Map([book('a'), book('b', { author: 'Ann Lee' }), book('done', { finished: true })].map((b) => [b.id, b]));
  const none = () => [];

  it('is undefined with no progress', () => {
    expect(pickResume([], books, none)).toBeUndefined();
  });

  it('takes the most recently saved position', () => {
    const info = pickResume([row('a', 100), row('b', 300, { percent: 42 }), row('a', 200, { mode: 'aloud' })], books, none);
    expect(info).toMatchObject({ bookId: 'b', title: 'Title b', author: 'Ann Lee', percent: 42, mode: 'read' });
  });

  it('skips a position at 0 %: a book that was only opened has nothing to come back to', () => {
    const info = pickResume([row('a', 100, { percent: 20 }), row('b', 300, { percent: 0 })], books, none);
    expect(info).toMatchObject({ bookId: 'a', percent: 20 });
    expect(pickResume([row('b', 300, { percent: 0 })], books, none)).toBeUndefined();
  });

  it('keeps the exact locator so a reader can land on the same spot', () => {
    const where = reflow(6, 1234);
    expect(pickResume([row('a', 1, { locator: where })], books, none)?.locator).toEqual(where);
  });

  it('skips finished books, 100 % rows and deleted books, falling back to the next newest', () => {
    const rows = [row('done', 500), row('a', 400, { percent: 100 }), row('gone', 300), row('b', 100)];
    expect(pickResume(rows, books, none)?.bookId).toBe('b');
  });

  it('is undefined when everything is finished or gone', () => {
    expect(pickResume([row('done', 5), row('gone', 4)], books, none)).toBeUndefined();
  });

  it('adds chapter number (1-based) and title when known', () => {
    const chapters = [chapter(6, 'The Storm', { locator: reflow(6) })];
    const info = pickResume([row('a', 1, { locator: reflow(6, 10) })], books, () => chapters);
    expect(info).toMatchObject({ chapterNumber: 7, chapterTitle: 'The Storm' });
  });

  it('leaves chapter fields out when unknown', () => {
    expect(pickResume([row('a', 1)], books, none)).not.toHaveProperty('chapterNumber');
  });
});

describe('loadResume', () => {
  let db: PageNestDB;
  beforeEach(() => {
    db = new PageNestDB(`resume-${Math.random()}`);
  });
  afterEach(async () => {
    db.close();
    await db.delete();
  });

  it('is undefined for an empty database', async () => {
    expect(await loadResume(db)).toBeUndefined();
  });

  it('returns nothing when the newest position is at 0 % (opened, not read), and falls back to an older book that was read', async () => {
    await db.books.bulkAdd([book('b1', { title: 'Opened only' }), book('b2', { title: 'Half read' })]);
    await db.progress.bulkAdd([
      { bookId: 'b1', mode: 'read', locator: reflow(0), percent: 0, updatedAt: 900 },
      { bookId: 'b2', mode: 'read', locator: reflow(3), percent: 50, updatedAt: 800 },
    ]);
    expect(await loadResume(db)).toMatchObject({ bookId: 'b2', percent: 50 });
    await db.progress.where('bookId').equals('b2').delete();
    expect(await loadResume(db)).toBeUndefined();
  });

  it('reads the newest unfinished book with its chapter from Dexie', async () => {
    await db.books.bulkAdd([book('b1', { title: 'Long Road' }), book('b2', { finished: true })]);
    await db.chapters.bulkAdd([chapter(0, 'Start', { locator: reflow(0) }), chapter(6, 'The Storm', { locator: reflow(6) })]);
    await db.progress.bulkAdd([
      row('b2', 900),
      { bookId: 'b1', mode: 'read', locator: reflow(6, 77), percent: 61.5, updatedAt: 800 },
    ]);
    const info = await loadResume(db);
    expect(info).toMatchObject({ bookId: 'b1', title: 'Long Road', chapterNumber: 7, chapterTitle: 'The Storm', percent: 61.5 });
    expect(info?.locator).toEqual(reflow(6, 77));
  });

  it('skips past more finished rows than it inspects at most, and stays undefined if all are finished', async () => {
    await db.books.add(book('f', { finished: true }));
    await db.progress.bulkAdd([row('f', 1, { mode: 'read' }), row('f', 2, { mode: 'listen', locator: { kind: 'audio', trackIndex: 0, positionSec: 1 } })]);
    expect(await loadResume(db)).toBeUndefined();
  });
});

describe('loadBookPosition', () => {
  let db: PageNestDB;
  beforeEach(() => {
    db = new PageNestDB(`position-${Math.random()}`);
  });
  afterEach(async () => {
    db.close();
    await db.delete();
  });

  it('carries the book kind so callers can choose the route', async () => {
    await db.books.add(book('a', { kind: 'audio', format: 'm4b' }));
    await db.progress.add(row('a', 1, { mode: 'listen', locator: { kind: 'audio', trackIndex: 0, positionSec: 5 } }));
    expect((await loadResume(db))?.kind).toBe('audio');
  });

  it('returns the newest position of one book, even a finished one, with its chapter', async () => {
    const progress = new DexieProgressService(db);
    await db.books.add(book('b1', { finished: true }));
    await db.chapters.add(chapter(2, 'Three', { locator: reflow(2) }));
    await progress.save('b1', 'read', reflow(2, 9), 100);
    const info = await loadBookPosition(db, progress, 'b1');
    expect(info).toMatchObject({ bookId: 'b1', kind: 'ebook', percent: 100, chapterNumber: 3, chapterTitle: 'Three' });
  });

  it('is undefined for an unknown book or a book never opened', async () => {
    const progress = new DexieProgressService(db);
    await db.books.add(book('b1'));
    expect(await loadBookPosition(db, progress, 'b1')).toBeUndefined();
    expect(await loadBookPosition(db, progress, 'nope')).toBeUndefined();
  });

  it('sees a position that is reported but not written yet', async () => {
    const progress = new DexieProgressService(db, { intervalMs: 60_000 });
    await db.books.add(book('b1'));
    progress.report('b1', 'read', reflow(0, 4), 33);
    expect((await loadBookPosition(db, progress, 'b1'))?.percent).toBe(33);
    await progress.flush();
  });
});
