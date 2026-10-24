import { describe, expect, it } from 'vitest';
import { PageNestDB } from './db';
import { LibraryQueryService, MAX_PAGE_SIZE } from './library-query';
import { bookRecord, setupFreshStorage } from './test-fixtures';
import type { ProgressRow } from './schema';

const ctx = setupFreshStorage();

function progress(bookId: string, mode: ProgressRow['mode'], percent: number): ProgressRow {
  const locator = mode === 'listen' ? ({ kind: 'audio', trackIndex: 0, positionSec: 1 } as const) : ({ kind: 'reflow', section: 0, textOffset: 1 } as const);
  return { bookId, mode, locator, percent, updatedAt: 1 };
}

async function seed(): Promise<LibraryQueryService> {
  await ctx.db.books.bulkAdd([
    bookRecord('a', { title: 'Persuasion', author: 'Jane Austen', addedAt: 100, lastOpenedAt: 900, favorite: true }),
    bookRecord('b', { title: 'Emma', author: 'Jane Austen', addedAt: 200, finished: true }),
    bookRecord('c', { title: 'Dracula', author: 'Bram Stoker', addedAt: 300, lastOpenedAt: 500 }),
    bookRecord('d', { title: 'The Hobbit', kind: 'audio', format: 'm4b', narrator: 'Rob Inglis', addedAt: 400 }),
    bookRecord('e', { title: 'Éclair Handbook', addedAt: 50 }),
  ]);
  return new LibraryQueryService(ctx.db);
}

const ids = async (svc: LibraryQueryService, q: Parameters<LibraryQueryService['query']>[0]): Promise<string[]> =>
  (await svc.query(q)).items.map((b) => b.id);

describe('LibraryQueryService: listing and sorting', () => {
  it('is empty for an empty library', async () => {
    const svc = new LibraryQueryService(ctx.db);
    expect(await svc.query()).toEqual({ total: 0, items: [] });
    expect(await svc.count()).toBe(0);
    svc.close();
  });

  it('recent: last opened first, never-opened books after, newest added first among them', async () => {
    const svc = await seed();
    expect(await ids(svc, { sort: 'recent' })).toEqual(['a', 'c', 'd', 'b', 'e']);
    expect(await ids(svc, { sort: 'recent', direction: 'asc' })).toEqual(['e', 'b', 'd', 'c', 'a']);
    expect(await ids(svc, {})).toEqual(['a', 'c', 'd', 'b', 'e']);
    svc.close();
  });

  it('added, title and author sort the way a person expects', async () => {
    const svc = await seed();
    expect(await ids(svc, { sort: 'added' })).toEqual(['d', 'c', 'b', 'a', 'e']);
    // Dracula, Éclair (accent ignored), Emma, Persuasion, The Hobbit.
    expect(await ids(svc, { sort: 'title' })).toEqual(['c', 'e', 'b', 'a', 'd']);
    expect(await ids(svc, { sort: 'title', direction: 'desc' })).toEqual(['d', 'a', 'b', 'e', 'c']);
    // Authors A to Z as written (Bram Stoker, then Jane Austen by title); books without an author come last.
    const byAuthor = await ids(svc, { sort: 'author' });
    expect(byAuthor.slice(0, 3)).toEqual(['c', 'b', 'a']);
    expect(byAuthor.slice(3).sort()).toEqual(['d', 'e']);
    svc.close();
  });

  it('segments: books and audio', async () => {
    const svc = await seed();
    expect(await ids(svc, { segment: 'audio' })).toEqual(['d']);
    expect((await svc.query({ segment: 'books' })).total).toBe(4);
    expect((await svc.query({ segment: 'all' })).total).toBe(5);
    svc.close();
  });

  it('status chips: favorites, finished, unfinished', async () => {
    const svc = await seed();
    expect(await ids(svc, { status: 'favorites' })).toEqual(['a']);
    expect(await ids(svc, { status: 'finished' })).toEqual(['b']);
    expect((await svc.query({ status: 'unfinished' })).total).toBe(4);
    svc.close();
  });

  it('status chips: reading and listening use saved progress and skip finished books', async () => {
    const svc = await seed();
    await ctx.db.progress.bulkAdd([
      progress('a', 'read', 40),
      progress('b', 'read', 90),
      progress('c', 'read', 0),
      progress('d', 'listen', 10),
      progress('e', 'aloud', 5),
    ]);
    expect((await ids(svc, { status: 'reading' })).sort()).toEqual(['a', 'e']);
    expect(await ids(svc, { status: 'listening' })).toEqual(['d']);
    svc.close();
  });

  it('pages with offset and limit and reports the total', async () => {
    const svc = await seed();
    const page = await svc.query({ sort: 'added', offset: 1, limit: 2 });
    expect(page.items.map((b) => b.id)).toEqual(['c', 'b']);
    expect(page.total).toBe(5);
    expect((await svc.query({ offset: 99 })).items).toEqual([]);
    expect((await svc.query({ limit: 100000 })).items).toHaveLength(5);
    expect(MAX_PAGE_SIZE).toBe(500);
    svc.close();
  });

  it('includes the furthest progress of each book without reading the whole progress table', async () => {
    const svc = await seed();
    await ctx.db.progress.bulkAdd([progress('a', 'read', 40), progress('a', 'aloud', 55), progress('b', 'read', 100)]);
    const page = await svc.query({ sort: 'added' });
    const byId = new Map(page.items.map((b) => [b.id, b.percent]));
    expect(byId.get('a')).toBe(55);
    expect(byId.get('b')).toBe(100);
    expect(byId.get('c')).toBe(0);
    svc.close();
  });
});

describe('LibraryQueryService: search', () => {
  it('finds by title, author, narrator and series, ignoring case and accents', async () => {
    const svc = await seed();
    expect(await ids(svc, { text: 'eclair' })).toEqual(['e']);
    expect(await ids(svc, { text: 'AUSTEN' })).toEqual(['b', 'a']);
    expect(await ids(svc, { text: 'inglis' })).toEqual(['d']);
    expect(await ids(svc, { text: 'nothing like this' })).toEqual([]);
    svc.close();
  });

  it('needs every word to match, in any order', async () => {
    const svc = await seed();
    expect(await ids(svc, { text: 'austen emma' })).toEqual(['b']);
    expect(await ids(svc, { text: 'emma stoker' })).toEqual([]);
    svc.close();
  });

  it('matches word starts while typing', async () => {
    const svc = await seed();
    expect(await ids(svc, { text: 'dra' })).toEqual(['c']);
    expect(await ids(svc, { text: 'hob' })).toEqual(['d']);
    svc.close();
  });

  it('ranks title matches above author matches', async () => {
    await ctx.db.books.bulkAdd([
      bookRecord('author-hit', { title: 'Unrelated', author: 'Emma Stone', addedAt: 1 }),
      bookRecord('title-hit', { title: 'Emma', author: 'Someone', addedAt: 2 }),
    ]);
    const svc = new LibraryQueryService(ctx.db);
    expect(await ids(svc, { text: 'emma' })).toEqual(['title-hit', 'author-hit']);
    svc.close();
  });

  it('combines text with segment, status and another sort', async () => {
    const svc = await seed();
    expect(await ids(svc, { text: 'jane', status: 'favorites' })).toEqual(['a']);
    expect(await ids(svc, { text: 'jane', sort: 'title' })).toEqual(['b', 'a']);
    expect(await ids(svc, { text: 'the', segment: 'audio' })).toEqual(['d']);
    svc.close();
  });

  it('a blank search lists everything', async () => {
    const svc = await seed();
    expect((await svc.query({ text: '   ' })).total).toBe(5);
    svc.close();
  });
});

describe('LibraryQueryService: shelves', () => {
  it('lists the books of a shelf in shelf order, and filters within it', async () => {
    const svc = await seed();
    await ctx.db.collections.add({ id: 's1', name: 'Favorites', order: 0 });
    await ctx.db.collectionBooks.bulkAdd([
      { collectionId: 's1', bookId: 'c', order: 0 },
      { collectionId: 's1', bookId: 'a', order: 1 },
      { collectionId: 's1', bookId: 'e', order: 2 },
    ]);
    expect(await ids(svc, { collectionId: 's1' })).toEqual(['c', 'a', 'e']);
    expect(await ids(svc, { collectionId: 's1', sort: 'title' })).toEqual(['c', 'e', 'a']);
    expect(await ids(svc, { collectionId: 's1', text: 'jane' })).toEqual(['a']);
    expect(await ids(svc, { collectionId: 'nope' })).toEqual([]);
    svc.close();
  });
});

describe('LibraryQueryService: staying current', () => {
  it('sees books added through the same database after the first query', async () => {
    const svc = await seed();
    expect((await svc.query()).total).toBe(5);
    await ctx.db.books.add(bookRecord('f', { title: 'Late Arrival' }));
    expect(await ids(svc, { text: 'late' })).toEqual(['f']);
    await ctx.db.books.update('f', { title: 'Renamed Thing' });
    expect(await ids(svc, { text: 'late' })).toEqual([]);
    expect(await ids(svc, { text: 'renamed' })).toEqual(['f']);
    await ctx.db.books.delete('f');
    expect(await ids(svc, { text: 'renamed' })).toEqual([]);
    svc.close();
  });

  it('sees changes made by another connection (an import worker, another tab)', async () => {
    const svc = await seed();
    await svc.query();
    const other = new PageNestDB(ctx.db.name);
    await other.books.add(bookRecord('g', { title: 'From The Importer' }));
    // Dexie announces changes between connections asynchronously.
    await new Promise((r) => setTimeout(r, 50));
    expect(await ids(svc, { text: 'importer' })).toEqual(['g']);
    other.close();
    svc.close();
  });

  it('answers many concurrent queries from one load', async () => {
    const svc = new LibraryQueryService(ctx.db);
    await ctx.db.books.add(bookRecord('x', { title: 'Only' }));
    const results = await Promise.all([svc.count(), svc.count(), svc.query({ text: 'only' })]);
    expect(results[0]).toBe(1);
    expect(results[1]).toBe(1);
    expect(results[2]).toMatchObject({ total: 1 });
    svc.close();
  });
});

describe('LibraryQueryService: scale', () => {
  it('searches and pages 20,000 books quickly', async () => {
    const words = ['river', 'stone', 'night', 'garden', 'silver', 'winter', 'harbor', 'ember', 'lantern', 'meadow'];
    const rows = Array.from({ length: 20_000 }, (_, i) =>
      bookRecord(`b${i}`, {
        title: `${words[i % 10]} ${words[(i * 7) % 10]} ${i}`,
        author: `Author ${i % 500}`,
        addedAt: i,
        lastOpenedAt: i % 3 === 0 ? i : undefined,
      }),
    );
    await ctx.db.books.bulkAdd(rows);
    const svc = new LibraryQueryService(ctx.db);
    await svc.count(); // load once

    const t0 = performance.now();
    const hits = await svc.query({ text: 'silv lan', limit: 60 });
    const searchMs = performance.now() - t0;
    expect(hits.total).toBeGreaterThan(0);

    const t1 = performance.now();
    await svc.query({ sort: 'title', limit: 60 });
    await svc.query({ sort: 'title', limit: 60, offset: 6000 });
    const sortMs = performance.now() - t1;

    // Typical: a few milliseconds. The limits are generous so a slow CI machine does not fail.
    expect(searchMs).toBeLessThan(400);
    expect(sortMs).toBeLessThan(1500);
    svc.close();
  }, 30_000);
});
