import { describe, expect, it } from 'vitest';
import { MemoryFileStore } from './opfs';
import { findBookFileRef, openBookFile } from './book-file';

describe('book-file', () => {
  it('opens by fileRef and finds files under books/id when the ref is wrong', async () => {
    const store = new MemoryFileStore();
    await store.write('books/b1/stored.epub', 'hello epub');
    const found = await findBookFileRef(store, 'b1', 'books/b1/wrong.epub');
    expect(found).toBe('books/b1/stored.epub');
    const file = await openBookFile(store, { id: 'b1', fileRef: 'books/b1/wrong.epub' });
    expect(file.size).toBeGreaterThan(0);
    expect(file.name).toContain('stored.epub');
  });

  it('throws a plain missing-file error when nothing is on disk', async () => {
    const store = new MemoryFileStore();
    await expect(openBookFile(store, { id: 'x', fileRef: 'books/x/book.epub' })).rejects.toMatchObject({ missing: true });
  });
});
