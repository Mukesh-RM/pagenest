import { describe, expect, it } from 'vitest';
import { CollectionError, CollectionRepository, MAX_SHELF_NAME_LENGTH } from './collections';
import { bookRecord, setupFreshStorage } from './test-fixtures';

const ctx = setupFreshStorage();
const shelves = (): CollectionRepository => new CollectionRepository(ctx.db);
const seedBooks = (...ids: string[]): Promise<unknown> => ctx.db.books.bulkAdd(ids.map((id) => bookRecord(id)));

describe('shelves', () => {
  it('creates shelves in order, with a trimmed name', async () => {
    const a = await shelves().create('  Summer   reads ');
    const b = await shelves().create('Classics');
    expect(a.name).toBe('Summer reads');
    expect([a.order, b.order]).toEqual([0, 1]);
    expect((await shelves().list()).map((s) => s.name)).toEqual(['Summer reads', 'Classics']);
    expect(await shelves().get(a.id)).toEqual(a);
    expect(await shelves().get('nope')).toBeUndefined();
  });

  it('rejects empty, too long and duplicate names (ignoring case and accents)', async () => {
    await shelves().create('Café');
    await expect(shelves().create('   ')).rejects.toMatchObject({ code: 'invalid-name' });
    await expect(shelves().create('x'.repeat(MAX_SHELF_NAME_LENGTH + 1))).rejects.toMatchObject({ code: 'invalid-name' });
    await expect(shelves().create('x'.repeat(MAX_SHELF_NAME_LENGTH))).resolves.toBeDefined();
    await expect(shelves().create('CAFE')).rejects.toBeInstanceOf(CollectionError);
    await expect(shelves().create('cafe')).rejects.toMatchObject({ code: 'duplicate-name', name: 'CollectionError' });
    expect(await ctx.db.collections.count()).toBe(2);
  });

  it('renames, allows a change of case on the same shelf, and refuses a clash', async () => {
    const a = await shelves().create('Alpha');
    await shelves().create('Beta');
    expect((await shelves().rename(a.id, 'ALPHA')).name).toBe('ALPHA');
    await expect(shelves().rename(a.id, 'beta')).rejects.toMatchObject({ code: 'duplicate-name' });
    await expect(shelves().rename(a.id, ' ')).rejects.toMatchObject({ code: 'invalid-name' });
    await expect(shelves().rename('nope', 'Gamma')).rejects.toMatchObject({ code: 'not-found' });
    expect((await shelves().get(a.id))?.name).toBe('ALPHA');
  });

  it('deletes a shelf and its links but never the books', async () => {
    await seedBooks('b1', 'b2');
    const a = await shelves().create('A');
    const b = await shelves().create('B');
    await shelves().addBooks(a.id, ['b1', 'b2']);
    await shelves().addBooks(b.id, ['b1']);
    expect(await shelves().remove(a.id)).toBe(true);
    expect(await shelves().remove(a.id)).toBe(false);
    expect(await ctx.db.books.count()).toBe(2);
    expect(await ctx.db.collectionBooks.toArray()).toEqual([{ collectionId: b.id, bookId: 'b1', order: 0 }]);
  });

  it('reorders shelves, keeping unlisted ones after, ignoring unknown ids', async () => {
    const [a, b, c, d] = [await shelves().create('A'), await shelves().create('B'), await shelves().create('C'), await shelves().create('D')];
    const result = await shelves().reorder([c.id, 'ghost', a.id, c.id]);
    expect(result.map((s) => s.name)).toEqual(['C', 'A', 'B', 'D']);
    expect((await shelves().list()).map((s) => [s.name, s.order])).toEqual([['C', 0], ['A', 1], ['B', 2], ['D', 3]]);
    // New shelves go to the end.
    expect((await shelves().create('E')).order).toBe(4);
    expect([a, b, d]).toHaveLength(3);
  });

  it('counts books per shelf', async () => {
    await seedBooks('b1', 'b2', 'b3');
    const a = await shelves().create('A');
    const b = await shelves().create('B');
    await shelves().addBooks(a.id, ['b1', 'b2', 'b3']);
    expect((await shelves().list()).map((s) => [s.name, s.bookCount])).toEqual([['A', 3], ['B', 0]]);
    expect(b.id).toBeDefined();
  });
});

describe('books on shelves', () => {
  it('adds in order and reports what happened to each id', async () => {
    await seedBooks('b1', 'b2', 'b3');
    const s = await shelves().create('S');
    expect(await shelves().addBooks(s.id, ['b2', 'b1', 'b2', 'zzz'])).toEqual({ added: ['b2', 'b1'], alreadyThere: [], unknown: ['zzz'] });
    expect(await shelves().addBooks(s.id, ['b1', 'b3'])).toEqual({ added: ['b3'], alreadyThere: ['b1'], unknown: [] });
    expect((await shelves().booksIn(s.id)).map((b) => b.id)).toEqual(['b2', 'b1', 'b3']);
    await expect(shelves().addBooks('nope', ['b1'])).rejects.toMatchObject({ code: 'not-found' });
  });

  it('removes books and renumbers the rest', async () => {
    await seedBooks('b1', 'b2', 'b3', 'b4');
    const s = await shelves().create('S');
    await shelves().addBooks(s.id, ['b1', 'b2', 'b3', 'b4']);
    expect(await shelves().removeBooks(s.id, ['b2', 'b4', 'zzz'])).toBe(2);
    expect(await shelves().removeBooks(s.id, ['b2'])).toBe(0);
    const links = await ctx.db.collectionBooks.where('collectionId').equals(s.id).sortBy('order');
    expect(links.map((l) => [l.bookId, l.order])).toEqual([['b1', 0], ['b3', 1]]);
    expect(await ctx.db.books.count()).toBe(4);
  });

  it('reorders books on a shelf', async () => {
    await seedBooks('b1', 'b2', 'b3', 'b4');
    const s = await shelves().create('S');
    await shelves().addBooks(s.id, ['b1', 'b2', 'b3', 'b4']);
    await shelves().reorderBooks(s.id, ['b3', 'ghost', 'b1']);
    expect((await shelves().booksIn(s.id)).map((b) => b.id)).toEqual(['b3', 'b1', 'b2', 'b4']);
    const links = await ctx.db.collectionBooks.where('collectionId').equals(s.id).sortBy('order');
    expect(links.map((l) => l.order)).toEqual([0, 1, 2, 3]);
  });

  it('keeps the order of one shelf separate from another', async () => {
    await seedBooks('b1', 'b2');
    const a = await shelves().create('A');
    const b = await shelves().create('B');
    await shelves().addBooks(a.id, ['b1', 'b2']);
    await shelves().addBooks(b.id, ['b2', 'b1']);
    await shelves().removeBooks(a.id, ['b1']);
    expect((await shelves().booksIn(b.id)).map((x) => x.id)).toEqual(['b2', 'b1']);
  });

  it('tells which shelves a book is on, in shelf order', async () => {
    await seedBooks('b1');
    const a = await shelves().create('A');
    const b = await shelves().create('B');
    await shelves().create('C');
    await shelves().addBooks(b.id, ['b1']);
    await shelves().addBooks(a.id, ['b1']);
    expect((await shelves().shelvesOf('b1')).map((s) => s.name)).toEqual(['A', 'B']);
    expect(await shelves().shelvesOf('b9')).toEqual([]);
  });

  it('skips a link whose book disappeared', async () => {
    await seedBooks('b1', 'b2');
    const s = await shelves().create('S');
    await shelves().addBooks(s.id, ['b1', 'b2']);
    await ctx.db.books.delete('b1');
    expect((await shelves().booksIn(s.id)).map((b) => b.id)).toEqual(['b2']);
  });
});
