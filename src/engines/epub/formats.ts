import type { BookFormat } from '@/app/contracts';

/** Parsed by foliate-js. */
export const FOLIATE_FORMATS = ['epub', 'mobi', 'azw3', 'fb2', 'cbz'] as const satisfies readonly BookFormat[];

/** Turned into reflowable text by the built-in converters (DOCX through mammoth.js). */
export const DOCUMENT_FORMATS = ['docx', 'txt', 'rtf', 'html', 'md'] as const satisfies readonly BookFormat[];
