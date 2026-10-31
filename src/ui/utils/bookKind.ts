import type { BookDetail } from '../types';

/** Formats that can be read as text or pages. A book in one of these is never "audio only". */
const READING_FORMATS = new Set(['EPUB', 'PDF', 'MOBI', 'AZW', 'AZW3', 'KF8', 'FB2', 'TXT', 'HTML', 'DOCX', 'CBZ', 'CBR', 'RTF']);

/**
 * True when a book can only be listened to: it has audio, no pages, and its format is not a text format.
 * `audioOnly` on the book wins over this rule in both directions.
 */
export function isAudioOnly(book: Pick<BookDetail, 'audio' | 'audioOnly' | 'pages' | 'format'>): boolean {
  if (book.audioOnly !== undefined) return book.audioOnly;
  if (!book.audio || book.pages) return false;
  return !(book.format && READING_FORMATS.has(book.format.trim().toUpperCase()));
}
