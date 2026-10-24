import type { BookKind } from '@/app/contracts';

/** Route patterns, for `<Route path>`. */
export const READ_ROUTE = '/read/:id';
export const LISTEN_ROUTE = '/listen/:id';

/** `/read/:id`: where an e-book, PDF or document opens. */
export function readPath(id: string): string {
  return `/read/${encodeURIComponent(id)}`;
}

/** `/listen/:id`: where an audiobook opens. */
export function listenPath(id: string): string {
  return `/listen/${encodeURIComponent(id)}`;
}

/** The route that opens a book, chosen by its `kind`: audiobooks listen, everything else reads. */
export function pathForBook(book: { readonly id: string; readonly kind: BookKind }): string {
  return book.kind === 'audio' ? listenPath(book.id) : readPath(book.id);
}
