// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { BookRepository, BookRepositoryError, safeFileName, type WriteLocks } from './books';
import { FileStoreError, MemoryFileStore, type FileData, type FileStore } from './opfs';
import { bookRecord, newBook, setupFreshStorage } from './test-fixtures';

const ctx = setupFreshStorage();
const repo = (now = () => 5000): BookRepository => new BookRepository(ctx.db, ctx.files, now);

/** A store that fails writes on demand, to prove nothing is left behind. */
class FailingStore extends MemoryFileStore {
  writes = 0;
  constructor(private readonly failOn: number, private readonly error: Error) {
    super();
  }
  override async write(path: string, data: FileData): Promise<void> {
    this.writes += 1;
    if (this.writes === this.failOn) throw this.error;
    return super.write(path, data);
  }
}

describe('BookRepository.add', () => {
  it('stores the book, its file, cover and chapters', async () => {
    const result = await repo().add(
      newBook(1, {
        title: '  Persuasion ',
        author: ' Jane Austen ',
        cover: new Blob(['img']),
        chapters: [
          { index: 0, title: 'One', locator: { kind: 'reflow', section: 0, textOffset: 0 } },
          { index: 1, title: 'Two', locator: { kind: 'reflow', section: 1, textOffset: 0 } },
        ],
        pages: 300,
      }),
    );
    if (result.status !== 'added') throw new Error('expected added');
    const b = result.book;
    expect(b).toMatchObject({ title: 'Persuasion', author: 'Jane Austen', addedAt: 5000, favorite: false, finished: false, pages: 300, kind: 'ebook', format: 'epub' });
    expect(b.fileRef).toBe(`books/${b.id}/book-1.epub`);
    expect(b.coverRef).toBe(`covers/${b.id}.img`);
    expect(await (await ctx.files.open(b.fileRef as string)).text()).toBe('bytes of 1');
    expect(await ctx.files.exists(b.coverRef as string)).toBe(true);
    expect(await ctx.db.books.get(b.id)).toEqual(b);
    expect((await repo().getChapters(b.id)).map((c) => c.title)).toEqual(['One', 'Two']);
  });

  it('leaves out empty optional fields', async () => {
    const result = await repo().add(newBook(2, { author: '   ', narrator: '', series: undefined }));
    if (result.status !== 'added') throw new Error('expected added');
    expect(result.book).not.toHaveProperty('author');
    expect(result.book).not.toHaveProperty('narrator');
    expect(result.book).not.toHaveProperty('coverRef');
  });

  it('reports a duplicate by fingerprint and writes nothing', async () => {
    const first = await repo().add(newBook(3));
    const before = await ctx.files.usage();
    const second = await repo().add(newBook(99, { fingerprint: 'fp-3', title: 'Same file, other name' }));
    expect(second.status).toBe('duplicate');
    if (first.status !== 'added' || second.status !== 'duplicate') throw new Error('unexpected');
    expect(second.existing.id).toBe(first.book.id);
    expect(await ctx.files.usage()).toBe(before);
    expect(await ctx.db.books.count()).toBe(1);
  });

  it('finds a duplicate before any bytes are copied', async () => {
    const first = await repo().add(newBook(4));
    expect((await repo().findByFingerprint('fp-4'))?.id).toBe(first.status === 'added' ? first.book.id : '');
    expect(await repo().findByFingerprint('missing')).toBeUndefined();
  });

  it('two imports of the same file at once store one book and leave no stray files', async () => {
    const r = repo();
    const [a, b] = await Promise.all([r.add(newBook(5)), r.add(newBook(5))]);
    expect([a.status, b.status].sort()).toEqual(['added', 'duplicate']);
    expect(await ctx.db.books.count()).toBe(1);
    const folders = await ctx.files.list('books');
    expect(folders).toHaveLength(1);
  });

  it('stores an audiobook made of several tracks', async () => {
    const result = await repo().add({
      fingerprint: 'fp-audio',
      kind: 'audio',
      format: 'mp3',
      title: 'Spoken',
      durationSec: 90,
      tracks: [
        { file: new Blob(['a']), fileName: 'one.mp3', title: 'Part 1', durationSec: 30, startOffsetSec: 0 },
        { file: new Blob(['bb']), fileName: 'two.mp3', title: 'Part 2', durationSec: 60, startOffsetSec: 30 },
      ],
    });
    if (result.status !== 'added') throw new Error('expected added');
    expect(result.book).not.toHaveProperty('fileRef');
    const tracks = await repo().getTracks(result.book.id);
    expect(tracks.map((t) => [t.index, t.title, t.startOffsetSec])).toEqual([[0, 'Part 1', 0], [1, 'Part 2', 30]]);
    expect(await ctx.files.size(tracks[1]?.fileRef as string)).toBe(2);
  });

  it('stores a one-file audiobook with its file', async () => {
    const result = await repo().add(newBook('m4b', { kind: 'audio', format: 'm4b', fileName: 'x.m4b' }));
    expect(result.status).toBe('added');
  });

  it('rejects input that cannot be a book, without writing anything', async () => {
    const bad = [
      newBook(10, { title: '   ' }),
      newBook(11, { fingerprint: ' ' }),
      newBook(12, { file: undefined }),
      { ...newBook(13), kind: 'audio' as const, file: undefined },
      newBook(14, { tracks: [{ file: new Blob(['x']), fileName: 'a.mp3', title: 't', durationSec: 1, startOffsetSec: 0 }] }),
    ];
    for (const input of bad) {
      await expect(repo().add(input)).rejects.toMatchObject({ name: 'BookRepositoryError', code: 'invalid-input' });
    }
    expect(await ctx.files.usage()).toBe(0);
    expect(await ctx.db.books.count()).toBe(0);
  });

  it('names stored files safely', () => {
    expect(safeFileName('../../etc/passwd', 'x')).toBe('_.._etc_passwd');
    expect(safeFileName('a/b\\c', 'x')).toBe('a_b_c');
    expect(safeFileName('   ', 'fallback.epub')).toBe('fallback.epub');
    expect(safeFileName(undefined, 'fallback')).toBe('fallback');
    expect(safeFileName('.hidden', 'x')).toBe('hidden');
  });

  it('keeps a file named with path tricks inside the book folder', async () => {
    const result = await repo().add(newBook(15, { fileName: '../../escape.epub' }));
    if (result.status !== 'added') throw new Error('expected added');
    expect(result.book.fileRef?.startsWith(`books/${result.book.id}/`)).toBe(true);
    expect(result.book.fileRef?.split('/')).toHaveLength(3);
  });

  it('cleans up every file when a later write fails', async () => {
    // The book file is written first, then the cover: fail on the cover.
    const failing = new FailingStore(2, new Error('disk error'));
    const r = new BookRepository(ctx.db, failing);
    await expect(r.add(newBook(17, { cover: new Blob(['c']) }))).rejects.toMatchObject({ code: 'write-failed' });
    expect(failing.writes).toBe(2);
    expect(await failing.list('books')).toEqual([]);
    expect(await failing.list('covers')).toEqual([]);
    expect(await ctx.db.books.count()).toBe(0);
  });

  it('reports a full device as storage-full and keeps nothing', async () => {
    const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    const files = new FailingStore(2, quota);
    const r = new BookRepository(ctx.db, files);
    const error = await r.add(newBook(18, { cover: new Blob(['c']) })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BookRepositoryError);
    expect((error as BookRepositoryError).code).toBe('storage-full');
    expect((error as BookRepositoryError).message).toMatch(/not enough space/);
    expect(await files.usage()).toBe(0);
    expect(await ctx.db.books.count()).toBe(0);
  });

  it('keeps nothing when the database write fails', async () => {
    const r = repo();
    await expect(r.add(newBook(19, { chapters: [{ index: 0, title: 'a' }, { index: 0, title: 'dup index' }] }))).rejects.toMatchObject({ code: 'write-failed' });
    expect(await ctx.db.books.count()).toBe(0);
    expect(await ctx.files.usage()).toBe(0);
  });
});

describe('BookRepository.update', () => {
  async function one(): Promise<{ id: string }> {
    await ctx.db.books.add(bookRecord('u1', { title: 'Old', author: 'A. Author', narrator: 'N', series: 'S', language: 'en', lastOpenedAt: 10 }));
    return { id: 'u1' };
  }

  it('edits metadata, trimming text', async () => {
    const { id } = await one();
    const updated = await repo().update(id, { title: '  New title ', author: 'B. Writer', favorite: true });
    expect(updated).toMatchObject({ title: 'New title', author: 'B. Writer', favorite: true, narrator: 'N' });
    expect(await ctx.db.books.get(id)).toEqual(updated);
  });

  it('clears optional fields with null or an empty string', async () => {
    const { id } = await one();
    const updated = await repo().update(id, { author: null, narrator: '  ', series: null, language: '', lastOpenedAt: null });
    for (const key of ['author', 'narrator', 'series', 'language', 'lastOpenedAt']) expect(updated).not.toHaveProperty(key);
  });

  it('leaves fields that are not mentioned alone', async () => {
    const { id } = await one();
    const updated = await repo().update(id, { finished: true });
    expect(updated).toMatchObject({ title: 'Old', author: 'A. Author', finished: true, lastOpenedAt: 10 });
  });

  it('refuses an empty title and an unknown book', async () => {
    const { id } = await one();
    await expect(repo().update(id, { title: '  ' })).rejects.toMatchObject({ code: 'invalid-input' });
    await expect(repo().update('nope', { favorite: true })).rejects.toMatchObject({ code: 'not-found' });
    expect((await ctx.db.books.get(id))?.title).toBe('Old');
  });

  it('markOpened stamps the time', async () => {
    const { id } = await one();
    expect((await repo(() => 777).markOpened(id)).lastOpenedAt).toBe(777);
  });

  it('replaces chapters', async () => {
    const { id } = await one();
    await repo().setChapters(id, [{ index: 0, title: 'A' }, { index: 1, title: 'B' }]);
    await repo().setChapters(id, [{ index: 0, title: 'Only' }]);
    expect((await repo().getChapters(id)).map((c) => c.title)).toEqual(['Only']);
    await expect(repo().setChapters('nope', [])).rejects.toMatchObject({ code: 'not-found' });
  });

  it('getMany keeps order and skips unknown ids', async () => {
    await ctx.db.books.bulkAdd([bookRecord('m1'), bookRecord('m2')]);
    expect((await repo().getMany(['m2', 'zzz', 'm1'])).map((b) => b.id)).toEqual(['m2', 'm1']);
  });
});

describe('BookRepository covers', () => {
  it('sets, reads, replaces and removes a cover', async () => {
    await ctx.db.books.add(bookRecord('c1'));
    expect(await repo().getCover('c1')).toBeUndefined();
    const ref = await repo().setCover('c1', new Blob(['first']));
    expect(ref).toBe('covers/c1.img');
    expect((await ctx.db.books.get('c1'))?.coverRef).toBe(ref);
    expect(await (await repo().getCover('c1'))?.text()).toBe('first');
    await repo().setCover('c1', new Blob(['second']));
    expect(await (await repo().getCover('c1'))?.text()).toBe('second');
    await repo().removeCover('c1');
    expect(await repo().getCover('c1')).toBeUndefined();
    expect(await ctx.files.exists('covers/c1.img')).toBe(false);
    expect(await ctx.db.books.get('c1')).not.toHaveProperty('coverRef');
  });

  it('refuses a cover for an unknown book and survives a missing file', async () => {
    await expect(repo().setCover('nope', new Blob(['x']))).rejects.toMatchObject({ code: 'not-found' });
    await ctx.db.books.add(bookRecord('c2', { coverRef: 'covers/c2.img' }));
    expect(await repo().getCover('c2')).toBeUndefined();
    await expect(repo().removeCover('nope')).resolves.toBeUndefined();
  });

  it('maps a write error on the cover', async () => {
    await ctx.db.books.add(bookRecord('c3'));
    const files = new FailingStore(1, Object.assign(new Error('q'), { name: 'QuotaExceededError' }));
    await expect(new BookRepository(ctx.db, files).setCover('c3', new Blob(['x']))).rejects.toMatchObject({ code: 'storage-full' });
    expect((await ctx.db.books.get('c3'))?.coverRef).toBeUndefined();
  });

  it('passes other file errors on unchanged', async () => {
    await ctx.db.books.add(bookRecord('c4', { coverRef: 'covers/c4.img' }));
    const files: FileStore = Object.assign(new MemoryFileStore(), {
      open: async () => {
        throw new FileStoreError('unsupported', 'nope');
      },
    });
    await expect(new BookRepository(ctx.db, files).getCover('c4')).rejects.toMatchObject({ code: 'unsupported' });
  });
});

/** A book with every kind of related row, for removal tests. */
async function seedFull(id: string, n: number): Promise<void> {
  const r = repo();
  const added = await r.add(newBook(n, { cover: new Blob(['cover']), chapters: [{ index: 0, title: 'c' }] }));
  if (added.status !== 'added') throw new Error('seed failed');
  const bookId = added.book.id;
  await ctx.db.progress.put({ bookId, mode: 'read', locator: { kind: 'reflow', section: 0, textOffset: 1 }, percent: 10, updatedAt: 1 });
  await ctx.db.bookmarks.put({ id: `bm-${id}`, bookId, locator: { kind: 'reflow', section: 0, textOffset: 2 }, label: 'x', createdAt: 1 });
  await ctx.db.highlights.put({
    id: `hl-${id}`,
    bookId,
    range: { start: { kind: 'reflow', section: 0, textOffset: 1 }, end: { kind: 'reflow', section: 0, textOffset: 5 } },
    text: 't',
    color: 'yellow',
    createdAt: 1,
  });
  await ctx.db.sessions.put({ id: `s-${id}`, bookId, mode: 'read', startedAt: 1, durationSec: 5 });
  await ctx.db.collections.put({ id: 'shelf', name: 'Shelf', order: 0 });
  await ctx.db.collectionBooks.put({ collectionId: 'shelf', bookId, order: 0 });
  await ctx.db.renders.put({ bookId, chapterIndex: 0, voiceId: 'v', style: 'natural', status: 'ready', audioRef: `renders/${bookId}/0-v-natural.opus` });
  await ctx.files.write(`renders/${bookId}/0-v-natural.opus`, 'opus');
}

const tables = ['books', 'chapters', 'progress', 'bookmarks', 'highlights', 'sessions', 'collectionBooks', 'renders'] as const;
const rowCounts = async (): Promise<number[]> => Promise.all(tables.map((t) => ctx.db.table(t).count()));

describe('BookRepository remove, undo and purge', () => {
  it('remove deletes the book, every related row and every file', async () => {
    await seedFull('x', 1);
    const [book] = await ctx.db.books.toArray();
    expect(book).toBeDefined();
    const receipt = await repo().remove([book?.id as string, 'unknown-id']);
    expect(receipt.bookIds).toEqual([book?.id]);
    expect(receipt.freedBytes).toBeGreaterThan(0);
    expect(await rowCounts()).toEqual(tables.map(() => 0));
    expect(await ctx.files.usage()).toBe(0);
    // The shelf stays; only the link went.
    expect(await ctx.db.collections.count()).toBe(1);
  });

  it('trash keeps the files and restore brings everything back', async () => {
    await seedFull('x', 1);
    const before = await rowCounts();
    const usage = await ctx.files.usage();
    const [book] = await ctx.db.books.toArray();
    const r = repo();
    const receipt = await r.trash([book?.id as string]);
    expect(await rowCounts()).toEqual(tables.map(() => 0));
    expect(await ctx.files.usage()).toBe(usage);
    const result = await r.restore(receipt.token);
    expect(result).toEqual({ restored: [book?.id], skipped: [] });
    expect(await rowCounts()).toEqual(before);
    expect(await ctx.db.books.get(book?.id as string)).toEqual(book);
  });

  it('purge finishes the removal and a second restore does nothing', async () => {
    await seedFull('x', 1);
    const [book] = await ctx.db.books.toArray();
    const r = repo();
    const receipt = await r.trash([book?.id as string]);
    expect(await r.purge(receipt.token)).toBeGreaterThan(0);
    expect(await ctx.files.usage()).toBe(0);
    expect(await r.restore(receipt.token)).toEqual({ restored: [], skipped: [] });
    expect(await r.purge(receipt.token)).toBe(0);
  });

  it('restore skips a book whose file was added again meanwhile, and deletes the old files', async () => {
    const r = repo();
    const first = await r.add(newBook(1));
    if (first.status !== 'added') throw new Error('seed');
    const receipt = await r.trash([first.book.id]);
    const again = await r.add(newBook(1));
    expect(again.status).toBe('added');
    const result = await r.restore(receipt.token);
    expect(result).toEqual({ restored: [], skipped: [first.book.id] });
    expect(await ctx.db.books.count()).toBe(1);
    expect(await ctx.files.exists(first.book.fileRef as string)).toBe(false);
  });

  it('restore does not bring back shelf links to a shelf deleted meanwhile', async () => {
    await seedFull('x', 1);
    const [book] = await ctx.db.books.toArray();
    const r = repo();
    const receipt = await r.trash([book?.id as string]);
    await ctx.db.collections.delete('shelf');
    await r.restore(receipt.token);
    expect(await ctx.db.collectionBooks.count()).toBe(0);
    expect(await ctx.db.books.count()).toBe(1);
  });

  it('trashes several books in one step and purgeAll finishes every pending removal', async () => {
    const r = repo();
    const a = await r.add(newBook(1));
    const b = await r.add(newBook(2));
    const c = await r.add(newBook(3));
    if (a.status !== 'added' || b.status !== 'added' || c.status !== 'added') throw new Error('seed');
    await r.trash([a.book.id, b.book.id]);
    await r.trash([c.book.id]);
    expect(await ctx.files.list('books')).toHaveLength(3);
    expect(await r.purgeAll()).toBeGreaterThan(0);
    expect(await ctx.files.list('books')).toHaveLength(0);
  });

  it('removing nothing is fine', async () => {
    const receipt = await repo().remove([]);
    expect(receipt.bookIds).toEqual([]);
  });
});

/** A small stand-in for `navigator.locks`: shared locks run together, an exclusive one runs alone. */
class FakeLocks implements WriteLocks {
  private shared = 0;
  private exclusive = false;
  private readonly waiting: Array<() => void> = [];

  async request<T>(_name: string, options: { mode: 'shared' | 'exclusive'; ifAvailable?: boolean }, callback: (lock: unknown) => Promise<T>): Promise<T> {
    const free = (): boolean => !this.exclusive && (options.mode === 'shared' || this.shared === 0);
    if (!free()) {
      if (options.ifAvailable) return callback(null);
      await new Promise<void>((resolve) => this.waiting.push(resolve));
      return this.request(_name, options, callback);
    }
    if (options.mode === 'shared') this.shared += 1;
    else this.exclusive = true;
    try {
      return await callback({});
    } finally {
      if (options.mode === 'shared') this.shared -= 1;
      else this.exclusive = false;
      for (const wake of this.waiting.splice(0)) wake();
    }
  }
}

const tick = (ms = 10): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('BookRepository.cleanupOrphans', () => {
  it('deletes files that belong to no book, and keeps the rest (a fresh start)', async () => {
    const before = repo();
    const kept = await before.add(newBook(1, { cover: new Blob(['c']) }));
    if (kept.status !== 'added') throw new Error('seed');
    await ctx.files.write('books/ghost/book.epub', 'leftover');
    await ctx.files.write('covers/ghost.img', 'cover');
    await ctx.files.write('renders/ghost/1.opus', 'audio');

    const report = await repo().cleanupOrphans(); // the next start: a new repository
    expect(report.removedBookIds).toEqual(['ghost']);
    expect(report.freedBytes).toBe('leftover'.length + 'cover'.length + 'audio'.length);
    expect(await ctx.files.exists('books/ghost/book.epub')).toBe(false);
    expect(await ctx.files.exists(kept.book.fileRef as string)).toBe(true);
    expect(await ctx.files.exists(kept.book.coverRef as string)).toBe(true);
  });

  it('does not touch books waiting in this repository trash', async () => {
    await ctx.db.books.add(bookRecord('t1', { fileRef: 'books/t1/book.epub' }));
    await ctx.files.write('books/t1/book.epub', 'bytes');
    const r = repo();
    await r.trash(['t1']);
    expect((await r.cleanupOrphans()).removedBookIds).toEqual([]);
    expect(await ctx.files.exists('books/t1/book.epub')).toBe(true);
  });

  it('is a no-op on empty storage', async () => {
    expect(await repo().cleanupOrphans()).toEqual({ removedBookIds: [], freedBytes: 0 });
  });

  describe('runs once, at startup, before any import', () => {
    it('refuses a second call, with a typed error, and deletes nothing', async () => {
      const r = repo();
      await r.cleanupOrphans();
      await ctx.files.write('books/ghost/book.epub', 'leftover');
      const error = await r.cleanupOrphans().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BookRepositoryError);
      expect(error).toMatchObject({ name: 'BookRepositoryError', code: 'cleanup-not-allowed' });
      expect((error as Error).message).toMatch(/already ran/);
      expect(await ctx.files.exists('books/ghost/book.epub')).toBe(true);
    });

    it('refuses a second call that overlaps the first', async () => {
      const r = repo();
      const first = r.cleanupOrphans();
      await expect(r.cleanupOrphans()).rejects.toMatchObject({ code: 'cleanup-not-allowed' });
      await expect(first).resolves.toBeDefined();
    });

    it('refuses once a book has been added, even if it turned out to be a duplicate', async () => {
      const r = repo();
      await r.add(newBook(1));
      await ctx.files.write('books/ghost/book.epub', 'leftover');
      await expect(r.cleanupOrphans()).rejects.toMatchObject({ code: 'cleanup-not-allowed', message: expect.stringMatching(/before any book is added/) });
      expect(await ctx.files.exists('books/ghost/book.epub')).toBe(true);

      const second = repo();
      await second.add(newBook(1)); // duplicate of the first: nothing stored, but an import has begun
      await expect(second.cleanupOrphans()).rejects.toMatchObject({ code: 'cleanup-not-allowed' });
    });

    it('is not blocked by an add that was rejected as invalid input', async () => {
      const r = repo();
      await expect(r.add(newBook(1, { title: ' ' }))).rejects.toMatchObject({ code: 'invalid-input' });
      await expect(r.cleanupOrphans()).resolves.toBeDefined();
    });

    it('can be retried when the clean-up itself failed (nothing had started)', async () => {
      let failures = 1;
      const files = new (class extends MemoryFileStore {
        override async list(path?: string) {
          if (failures-- > 0) throw new Error('disk hiccup');
          return super.list(path);
        }
      })();
      const r = new BookRepository(ctx.db, files);
      await expect(r.cleanupOrphans()).rejects.toThrow('disk hiccup');
      await expect(r.cleanupOrphans()).resolves.toEqual({ removedBookIds: [], freedBytes: 0 });
      await expect(r.cleanupOrphans()).rejects.toMatchObject({ code: 'cleanup-not-allowed' });
    });

    it('a book added during the clean-up waits for it and keeps its files', async () => {
      const files = new (class extends MemoryFileStore {
        override async list(path?: string) {
          await tick(15);
          return super.list(path);
        }
      })();
      await files.write('books/ghost/book.epub', 'leftover');
      const r = new BookRepository(ctx.db, files);
      const cleaning = r.cleanupOrphans();
      const adding = r.add(newBook(1));
      const [report, added] = await Promise.all([cleaning, adding]);
      expect(report.removedBookIds).toEqual(['ghost']);
      if (added.status !== 'added') throw new Error('expected added');
      expect(await files.exists(added.book.fileRef as string)).toBe(true);
    });
  });

  describe('with Web Locks (another worker or tab may be importing)', () => {
    it('refuses while another repository is adding a book, and deletes nothing', async () => {
      const locks = new FakeLocks();
      const slow = new (class extends MemoryFileStore {
        override async write(path: string, data: FileData) {
          await super.write(path, data);
          await tick(30);
        }
      })();
      const importer = new BookRepository(ctx.db, slow, () => 1, locks);
      const adding = importer.add(newBook(1));
      await tick(5);
      await ctx.files.write('books/ghost/book.epub', 'leftover');
      const starter = new BookRepository(ctx.db, ctx.files, () => 1, locks);
      await expect(starter.cleanupOrphans()).rejects.toMatchObject({ code: 'cleanup-not-allowed', message: expect.stringMatching(/being added right now/) });
      expect(await ctx.files.exists('books/ghost/book.epub')).toBe(true);
      expect((await adding).status).toBe('added');
      expect(await slow.list('books')).toHaveLength(1);
    });

    it('runs when nobody is importing, and an import that starts meanwhile waits for it', async () => {
      const locks = new FakeLocks();
      const slow = new (class extends MemoryFileStore {
        override async list(path?: string) {
          await tick(15);
          return super.list(path);
        }
      })();
      await slow.write('books/ghost/book.epub', 'leftover');
      const starter = new BookRepository(ctx.db, slow, () => 1, locks);
      const importer = new BookRepository(ctx.db, slow, () => 1, locks);
      const cleaning = starter.cleanupOrphans();
      await tick(3);
      const added = await importer.add(newBook(1)); // waits for the exclusive lock
      expect((await cleaning).removedBookIds).toEqual(['ghost']);
      if (added.status !== 'added') throw new Error('expected added');
      expect(await slow.exists(added.book.fileRef as string)).toBe(true);
    });
  });
});
