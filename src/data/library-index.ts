import type { BookRecord } from './schema';

/**
 * Pure search and sort helpers for the library (blueprint section 6: "5,000 titles scroll
 * smoothly"). No database access here: `LibraryQueryService` keeps an in-memory snapshot of the
 * books in the data worker and uses these functions on it, so a search over thousands of books
 * takes a few milliseconds and never touches the main thread.
 */

/** Lower-case, accents removed, anything that is not a letter or digit turned into one space. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The words of a search box entry, normalized. An empty entry gives no terms. */
export function searchTerms(text: string): string[] {
  const n = normalizeText(text);
  return n === '' ? [] : n.split(' ');
}

/** What the index remembers about one book. */
export interface IndexedBook {
  readonly book: BookRecord;
  readonly title: string;
  readonly titleWords: readonly string[];
  readonly author: string;
  readonly authorWords: readonly string[];
  /** Narrator and series together: searchable, ranked lowest. */
  readonly other: string;
  readonly otherWords: readonly string[];
}

export function indexBook(book: BookRecord): IndexedBook {
  const title = normalizeText(book.title);
  const author = normalizeText(book.author ?? '');
  const other = normalizeText(`${book.narrator ?? ''} ${book.series ?? ''}`);
  return {
    book,
    title,
    titleWords: title === '' ? [] : title.split(' '),
    author,
    authorWords: author === '' ? [] : author.split(' '),
    other,
    otherWords: other === '' ? [] : other.split(' '),
  };
}

function hasPrefix(words: readonly string[], term: string): boolean {
  for (const w of words) if (w.startsWith(term)) return true;
  return false;
}

/**
 * How well one term matches a book: 0 means no match. Order of importance:
 * title starts with the term (6), a title word starts with it (5), author word prefix (4),
 * inside a title word (3), inside the author (2), narrator or series (1).
 */
function termScore(doc: IndexedBook, term: string): number {
  if (doc.title.startsWith(term)) return 6;
  if (hasPrefix(doc.titleWords, term)) return 5;
  if (hasPrefix(doc.authorWords, term)) return 4;
  if (doc.title.includes(term)) return 3;
  if (doc.author.includes(term)) return 2;
  if (doc.other.includes(term)) return 1;
  return 0;
}

/** Total score of a book for all terms, or 0 when any term does not match (every word must match). */
export function scoreBook(doc: IndexedBook, terms: readonly string[]): number {
  let total = 0;
  for (const term of terms) {
    const s = termScore(doc, term);
    if (s === 0) return 0;
    total += s;
  }
  return total;
}

/** Compare titles the way a person expects: accents and case ignored, numbers in order ("Book 2" before "Book 10"). */
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function compareText(a: string, b: string): number {
  return collator.compare(a, b);
}
