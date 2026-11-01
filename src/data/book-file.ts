import type { FileRef } from '@/app/contracts';
import type { BookRecord } from './schema';
import { FileStoreError, type FileStore } from './opfs';

const MISSING =
  'The file for this book is missing. Your browser may have cleared it; add the book to your library again.';

/** Locate book bytes when `fileRef` is stale but files still live under `books/<id>/`. */
export async function findBookFileRef(store: FileStore, bookId: string, preferred?: FileRef): Promise<FileRef | undefined> {
  if (preferred && (await store.exists(preferred))) return preferred;
  const dir = `books/${bookId}`;
  const entries = await store.list(dir);
  const file = entries.find((e) => e.kind === 'file');
  if (!file) return undefined;
  return `${dir}/${file.name}`;
}

/** Open the main book file, reconciling legacy paths when needed. */
export async function openBookFile(store: FileStore, book: Pick<BookRecord, 'id' | 'fileRef'>): Promise<File> {
  const preferred = book.fileRef;
  if (!preferred) throw Object.assign(new Error('This book has no file.'), { missing: true });
  const resolved = await findBookFileRef(store, book.id, preferred);
  if (!resolved) throw Object.assign(new Error(MISSING), { missing: true });
  try {
    return await store.open(resolved);
  } catch (error) {
    if (error instanceof FileStoreError && error.code === 'not-found') {
      throw Object.assign(new Error(MISSING), { missing: true, cause: error });
    }
    throw error;
  }
}
