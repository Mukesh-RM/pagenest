import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BookRepository } from '@/data/books';
import { CollectionRepository } from '@/data/collections';
import { PageNestDB } from '@/data/db';
import { bookRecord } from '@/data/test-fixtures';
import { MemoryFileStore } from '@/data/opfs';
import { generatePairingCode } from './crypto';
import { mergeSyncPayload } from './merge';
import { buildMetadataPayload } from './payload';
import { exportSyncFile, importSyncFile } from './sync-io';

describe('sync crypto and merge', () => {
  let db: PageNestDB;

  beforeAll(() => {
    const proto = Blob.prototype as unknown as Record<string, unknown>;
    proto['text'] ??= function (this: Blob) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    };
  });

  afterEach(async () => {
    if (db) {
      db.close();
      await db.delete();
    }
  });

  it('encrypts and merges progress with last-write-wins', async () => {
    db = new PageNestDB(`sync-${Math.random()}`);
    const files = new MemoryFileStore();
    const books = new BookRepository(db, files);
    const collections = new CollectionRepository(db);
    await db.books.put(bookRecord('b1', { fingerprint: 'fp-shared', title: 'Shared' }));
    await db.progress.put({ bookId: 'b1', mode: 'read', locator: { kind: 'reflow', section: 0, textOffset: 10 }, percent: 5, updatedAt: 100 });

    const remote = await buildMetadataPayload(db, 500);
    (remote.data.progress[0] as { updatedAt: number; bookId: string }).updatedAt = 200;
    (remote.data.books[0] as { id: string }).id = 'remote-b1';
    (remote.data.progress[0] as { bookId: string }).bookId = 'remote-b1';

    const summary = await mergeSyncPayload(remote, { db, books, collections });
    expect(summary.booksMatched).toBe(1);
    expect((await db.progress.get(['b1', 'read']))?.updatedAt).toBe(200);
  });

  it('exports and imports an encrypted metadata file', async () => {
    db = new PageNestDB(`sync-file-${Math.random()}`);
    const files = new MemoryFileStore();
    await db.books.put(bookRecord('b1', { fingerprint: 'fp-a', title: 'A' }));
    await db.highlights.put({
      id: 'h1',
      bookId: 'b1',
      range: {
        start: { kind: 'reflow', section: 0, textOffset: 1 },
        end: { kind: 'reflow', section: 0, textOffset: 5 },
      },
      text: 'hello',
      color: 'yellow',
      createdAt: 50,
    });

    const code = generatePairingCode();
    const { blob } = await exportSyncFile(db, files, code, { includeFiles: false }, () => undefined);

    const db2 = new PageNestDB(`sync-file2-${Math.random()}`);
    const files2 = new MemoryFileStore();
    const books2 = new BookRepository(db2, files2);
    await db2.books.put(bookRecord('b1', { fingerprint: 'fp-a', title: 'A' }));

    const result = await importSyncFile(blob, code, { db: db2, files: files2, books: books2, collections: new CollectionRepository(db2) }, () => undefined);
    expect(result.kind).toBe('metadata');
    expect(await db2.highlights.get('h1')).toBeTruthy();

    db2.close();
    await db2.delete();
  });
});
