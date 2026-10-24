// Shared by tests only: small builders for books and a database that cleans itself up.
import { afterEach, beforeEach } from 'vitest';
import { PageNestDB } from './db';
import { MemoryFileStore } from './opfs';
import type { NewBook } from './books';
import type { BookRecord } from './schema';

let counter = 0;

/** Give each test a fresh database (and file store) named uniquely; deleted afterwards. */
export function setupFreshStorage(): { db: PageNestDB; files: MemoryFileStore } {
  const ctx = { db: undefined as unknown as PageNestDB, files: undefined as unknown as MemoryFileStore };
  beforeEach(() => {
    counter += 1;
    ctx.db = new PageNestDB(`fixture-${counter}-${Math.random()}`);
    ctx.files = new MemoryFileStore();
  });
  afterEach(async () => {
    ctx.db.close();
    await ctx.db.delete();
  });
  return ctx;
}

export function bookRecord(id: string, rest: Partial<BookRecord> = {}): BookRecord {
  return {
    id,
    fingerprint: `fp-${id}`,
    kind: 'ebook',
    format: 'epub',
    title: `Title ${id}`,
    addedAt: 1000,
    favorite: false,
    finished: false,
    ...rest,
  };
}

export function newBook(n: number | string, rest: Partial<NewBook> = {}): NewBook {
  return {
    fingerprint: `fp-${n}`,
    kind: 'ebook',
    format: 'epub',
    title: `Book ${n}`,
    file: new Blob([`bytes of ${n}`]),
    fileName: `book-${n}.epub`,
    ...rest,
  };
}
