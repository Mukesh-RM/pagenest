import type { BookFormat, BookKind } from '@/app/contracts';

/** Why a file cannot be added. Each reason has one plain-words message (see {@link UNSUPPORTED_MESSAGES}). */
export type UnsupportedReason =
  | 'empty'
  | 'drm'
  | 'damaged'
  | 'zip-not-book'
  | 'zipped-fb2'
  | 'unsupported-type'
  | 'storage-full'
  | 'failed'
  | 'storage-unavailable';

/** Plain words for people. Never codes or stack traces (blueprint 5.8). */
export const UNSUPPORTED_MESSAGES: Readonly<Record<UnsupportedReason, string>> = {
  empty: 'This file is empty, so there is nothing to add.',
  drm: 'This file is protected by DRM, so PageNest cannot open it.',
  damaged: 'This file looks damaged. Try another copy.',
  'zip-not-book': 'This is a ZIP archive with no book inside it.',
  'zipped-fb2': 'This is a zipped FB2 book. Unzip it first, then add the FB2 file.',
  'unsupported-type': 'PageNest cannot open this kind of file. It opens e-books, PDFs, documents, comics and audiobooks.',
  failed: 'PageNest could not add this file. Try it again, or try another copy.',
  'storage-full': 'There is not enough space on this device. Free some space and try again.',
  'storage-unavailable': 'This browser cannot keep books here, for example in a private window. Open PageNest in a normal window.',
};

/** What the content of a file turned out to be. */
export type SniffResult =
  | { readonly ok: true; readonly kind: BookKind; readonly format: BookFormat }
  | { readonly ok: false; readonly reason: UnsupportedReason };

/** Cover picture bytes as found in the file (any common image type). */
export interface CoverBytes {
  readonly bytes: Uint8Array;
}

export interface ParsedChapter {
  readonly title: string;
  readonly startSec: number;
}

/** Everything a parser can read from a file. All fields are optional: a damaged file still imports. */
export interface ParsedMeta {
  title?: string;
  author?: string;
  narrator?: string;
  series?: string;
  language?: string;
  pages?: number;
  durationSec?: number;
  cover?: CoverBytes;
  chapters?: ParsedChapter[];
  /** Audio only: the tag title of this one file (the book title is the album). */
  trackTitle?: string;
}

/** Keep metadata short, single-line and free of control characters. */
export function cleanText(value: unknown, max = 300): string | undefined {
  if (typeof value !== 'string') return undefined;
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text === '' ? undefined : text.slice(0, max);
}

/** Normalize a language code to a lower-case BCP 47 tag, or `undefined`. */
export function cleanLanguage(value: unknown): string | undefined {
  const text = cleanText(value, 35)?.replace(/_/g, '-');
  if (!text || !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(text)) return undefined;
  const [primary, ...rest] = text.split('-');
  return [primary?.toLowerCase(), ...rest.map((p) => (p.length === 2 ? p.toUpperCase() : p))].join('-');
}
