// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { BookRepository } from './books';
import { PageNestDB } from './db';
import { LibraryQueryService, type LibraryQuery } from './library-query';
import { MemoryFileStore } from './opfs';
import { bookRecord, newBook, setupFreshStorage } from './test-fixtures';

/**
 * The snapshot is patched from change notifications instead of being read again. These tests hold
 * it to the only rule that matters: a long-lived service must answer exactly like a brand-new one
 * that reads the table from scratch.
 */
const ctx = setupFreshStorage();

const QUERIES: LibraryQuery[] = [
  { limit: 500 },
  { sort: 'recent', direction: 'asc', limit: 500 },
  { sort: 'added', limit: 500 },
  { sort: 'added', direction: 'asc', limit: 500 },
  { sort: 'title', limit: 500 },
  { sort: 'title', direction: 'desc', limit: 500 },
  { sort: 'author', limit: 500 },
  { text: 'silver', limit: 500 },
  { text: 'silv lan', sort: 'title', limit: 500 },
  { segment: 'audio', limit: 500 },
  { status: 'favorites', sort: 'title', limit: 500 },
  { status: 'finished', limit: 500 },
];

async function expectSameAsFresh(live: LibraryQueryService, db: PageNestDB): Promise<void> {
  const fresh = new LibraryQueryService(db);
  try {
    for (const q of QUERIES) {
      const [a, b] = await Promise.all([live.query(q), fresh.query(q)]);
      expect(a.items.map((i) => i.id), JSON.stringify(q)).toEqual(b.items.map((i) => i.id));
      expect(a.total).toBe(b.total);
    }
    expect(await live.count()).toBe(await fresh.count());
  } finally {
    fresh.close();
  }
}

const WORDS = ['river', 'silver', 'lantern', 'stone', 'garden', 'night'];
function seedRows(n: number) {
  return Array.from({ length: n }, (_, i) =>
    bookRecord(`s${i}`, {
      title: `${WORDS[i % 6]} ${WORDS[(i * 5) % 6]} ${i}`,
      author: `Author ${i % 7}`,
      kind: i % 4 === 0 ? 'audio' : 'ebook',
      format: i % 4 === 0 ? 'm4b' : 'epub',
      addedAt: 1000 + i,
      lastOpenedAt: i % 3 === 0 ? 5000 + ((i * 37) % 101) : undefined,
      favorite: i % 5 === 0,
      finished: i % 7 === 0,
    }),
  );
}

describe('LibraryQueryService: patching the snapshot', () => {
  it('after one write it reads that book only, not the table', async () => {
    await ctx.db.books.bulkAdd(seedRows(200));
    const svc = new LibraryQueryService(ctx.db);
    await svc.query({ sort: 'title' }); // first load (reads the table once)
    const toArray = vi.spyOn(ctx.db.books, 'toArray');
    const bulkGet = vi.spyOn(ctx.db.books, 'bulkGet');
    const repo = new BookRepository(ctx.db, ctx.files);

    await repo.update('s3', { title: 'Zzz moved to the end' });
    const page = await svc.query({ sort: 'title', direction: 'desc', limit: 1 });
    expect(page.items[0]?.id).toBe('s3');
    expect(toArray).not.toHaveBeenCalled();
    expect(bulkGet).toHaveBeenCalledTimes(1);
    expect(bulkGet.mock.calls[0]?.[0]).toEqual(['s3']);

    await repo.add(newBook('fresh', { title: 'Brand new' }));
    await svc.query();
    await repo.remove(['s4']);
    expect((await svc.query({ limit: 500 })).items.some((b) => b.id === 's4')).toBe(false);
    expect(toArray).not.toHaveBeenCalled();
    svc.close();
  });

  it('guards the 5,000-book case: one write means one row read, never the table', async () => {
    // Timing is measured by scripts/bench-library.mjs (docs/DATA_LAYER.md). A clock would make this
    // test flaky, so it counts what was read instead: that is what the milliseconds were spent on.
    await ctx.db.books.bulkAdd(seedRows(5000));
    const svc = new LibraryQueryService(ctx.db);
    await svc.query({ sort: 'title' });
    await svc.query({ text: 'silver' });
    const toArray = vi.spyOn(ctx.db.books, 'toArray');
    const bulkGet = vi.spyOn(ctx.db.books, 'bulkGet');
    const repo = new BookRepository(ctx.db, ctx.files);
    for (let i = 0; i < 5; i++) {
      await repo.update(`s${i * 100}`, { title: `Zqx${i}y` });
      expect((await svc.query({ text: `zqx${i}y` })).total).toBe(1);
    }
    expect(toArray).not.toHaveBeenCalled();
    expect(bulkGet.mock.calls.map((c) => c[0])).toEqual([['s0'], ['s100'], ['s200'], ['s300'], ['s400']]);
    svc.close();
  }, 30_000);

  it('answers exactly like a fresh service after every kind of write through the repository', async () => {
    await ctx.db.books.bulkAdd(seedRows(60));
    const files = new MemoryFileStore();
    const repo = new BookRepository(ctx.db, files);
    const svc = new LibraryQueryService(ctx.db);
    await expectSameAsFresh(svc, ctx.db); // builds every sorted list

    const steps: Array<[string, () => Promise<unknown>]> = [
      ['add', () => repo.add(newBook('n1', { title: 'Silver lantern', author: 'Zed' }))],
      ['add audio', () => repo.add({ fingerprint: 'fp-n2', kind: 'audio', format: 'm4b', title: 'Aaa audio', file: new Blob(['a']), fileName: 'a.m4b' })],
      ['rename', () => repo.update('s1', { title: 'Silver lantern again' })],
      ['author', () => repo.update('s2', { author: null })],
      ['favorite', () => repo.update('s3', { favorite: true, finished: true })],
      ['markOpened', () => repo.markOpened('s5')],
      ['clear lastOpened', () => repo.update('s3', { lastOpenedAt: null })],
      ['duplicate add (no change)', () => repo.add(newBook('n1'))],
      ['bulk update in one tx', () => ctx.db.books.where('id').anyOf('s10', 's11', 's12').modify({ title: 'Silver garden' })],
      ['trash', async () => void (await repo.trash(['s6', 's7']))],
      ['remove', () => repo.remove(['s8'])],
      ['cover', () => repo.setCover('s9', new Blob(['c']))],
      ['remove cover', () => repo.removeCover('s9')],
    ];
    for (const [name, step] of steps) {
      await step();
      try {
        await expectSameAsFresh(svc, ctx.db);
      } catch (error) {
        throw new Error(`after "${name}": ${(error as Error).message}`);
      }
    }

    // Trash, then restore and purge.
    const receipt = await repo.trash(['s13', 's14']);
    await expectSameAsFresh(svc, ctx.db);
    expect(await repo.restore(receipt.token)).toMatchObject({ restored: ['s13', 's14'] });
    await expectSameAsFresh(svc, ctx.db);
    const second = await repo.trash(['s15']);
    await repo.purge(second.token);
    await expectSameAsFresh(svc, ctx.db);
    svc.close();
  });

  it('follows writes made by another connection (the import worker)', async () => {
    await ctx.db.books.bulkAdd(seedRows(40));
    const svc = new LibraryQueryService(ctx.db);
    await expectSameAsFresh(svc, ctx.db);
    const toArray = vi.spyOn(ctx.db.books, 'toArray');

    const other = new PageNestDB(ctx.db.name);
    const theirs = new BookRepository(other, new MemoryFileStore());
    await theirs.add(newBook('imported', { title: 'Silver lantern imported' }));
    await theirs.update('s2', { title: 'Renamed elsewhere' });
    await theirs.remove(['s3']);
    await vi.waitFor(async () => {
      const page = await svc.query({ text: 'imported' });
      expect(page.total).toBe(1);
    });
    await vi.waitFor(async () => expect((await svc.query({ text: 'renamed elsewhere' })).total).toBe(1));
    expect(toArray).not.toHaveBeenCalled(); // checked before the comparison below, which reads a fresh copy
    await expectSameAsFresh(svc, ctx.db);
    other.close();
    svc.close();
  });

  it('stays correct when queries and writes overlap', async () => {
    await ctx.db.books.bulkAdd(seedRows(80));
    const repo = new BookRepository(ctx.db, ctx.files);
    const svc = new LibraryQueryService(ctx.db);
    await expectSameAsFresh(svc, ctx.db);

    const work: Promise<unknown>[] = [];
    for (let i = 0; i < 25; i++) {
      work.push(repo.update(`s${i}`, { title: `Silver lantern ${i}`, favorite: i % 2 === 0 }));
      work.push(svc.query({ sort: 'title', limit: 500 }));
      if (i % 5 === 0) work.push(repo.add(newBook(`o${i}`, { title: `Overlap ${i}` })));
      if (i % 7 === 0) work.push(svc.query({ text: 'silver', limit: 500 }));
    }
    await Promise.all(work);
    await expectSameAsFresh(svc, ctx.db);
    expect((await svc.query({ text: 'silver lantern', limit: 500 })).total).toBe(25);
    svc.close();
  });

  it('a query that starts during a refresh still sees the write that caused it', async () => {
    await ctx.db.books.bulkAdd(seedRows(30));
    const repo = new BookRepository(ctx.db, ctx.files);
    const svc = new LibraryQueryService(ctx.db);
    await svc.count();
    await repo.update('s1', { title: 'First change' });
    const first = svc.query({ text: 'first change' }); // starts the refresh
    await repo.update('s2', { title: 'Second change' }); // lands while it runs
    const second = svc.query({ text: 'second change' });
    expect((await first).total).toBe(1);
    expect((await second).total).toBe(1);
    svc.close();
  });

  describe('when a change cannot be named, it reads the table once and carries on', () => {
    it('clear()', async () => {
      await ctx.db.books.bulkAdd(seedRows(20));
      const svc = new LibraryQueryService(ctx.db);
      expect(await svc.count()).toBe(20);
      await ctx.db.books.clear();
      expect(await svc.count()).toBe(0);
      await ctx.db.books.add(bookRecord('x'));
      expect((await svc.query()).items.map((b) => b.id)).toEqual(['x']);
      svc.close();
    });

    it('a very large batch', async () => {
      await ctx.db.books.bulkAdd(seedRows(10));
      const svc = new LibraryQueryService(ctx.db);
      await svc.count();
      const toArray = vi.spyOn(ctx.db.books, 'toArray');
      await ctx.db.books.bulkAdd(seedRows(700).map((b, i) => ({ ...b, id: `big${i}`, fingerprint: `bigfp${i}` })));
      expect(await svc.count()).toBe(710);
      expect(toArray).toHaveBeenCalledTimes(1);
      await expectSameAsFresh(svc, ctx.db);
      svc.close();
    });

    it('invalidate() by hand', async () => {
      await ctx.db.books.bulkAdd(seedRows(5));
      const svc = new LibraryQueryService(ctx.db);
      await svc.count();
      const toArray = vi.spyOn(ctx.db.books, 'toArray');
      svc.invalidate();
      await svc.count();
      expect(toArray).toHaveBeenCalledTimes(1);
      svc.close();
    });
  });

  it('writes to other tables do not touch the snapshot', async () => {
    await ctx.db.books.bulkAdd(seedRows(10));
    const svc = new LibraryQueryService(ctx.db);
    await svc.count();
    const toArray = vi.spyOn(ctx.db.books, 'toArray');
    const bulkGet = vi.spyOn(ctx.db.books, 'bulkGet');
    await ctx.db.progress.put({ bookId: 's1', mode: 'read', locator: { kind: 'reflow', section: 0, textOffset: 1 }, percent: 10, updatedAt: 1 });
    await ctx.db.collections.put({ id: 'c', name: 'C', order: 0 });
    await svc.query();
    expect(toArray).not.toHaveBeenCalled();
    expect(bulkGet).not.toHaveBeenCalled();
    svc.close();
  });
});
