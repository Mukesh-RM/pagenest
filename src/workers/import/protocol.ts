import type { BookRecord } from '@/data/schema';
import type { UnsupportedReason } from './types';

/**
 * Messages between the Library and the import worker. All of it is plain, structured-cloneable
 * data (File and Blob travel by reference). One `jobId` per request, chosen by the caller.
 */

/** A file to import. `relPath` is set for files that came from a folder (`Folder/Part 1/01.mp3`). */
export interface ImportItem {
  file: File;
  relPath?: string;
}

/** A book as stored. */
export type StoredBook = BookRecord;

/** What happened to one file (or one folder of audio files that became one book). */
export type ItemOutcome =
  | { status: 'added'; name: string; book: StoredBook }
  | { status: 'duplicate'; name: string; title: string; bookId: string }
  | { status: 'unsupported'; name: string; reason: UnsupportedReason; message: string }
  /** A cover picture or other file next to audio files in a folder; used or skipped without comment. */
  | { status: 'skipped'; name: string };

export interface ImportSummary {
  added: number;
  duplicates: number;
  unsupported: number;
  skipped: number;
}

export interface RestoreSummary {
  booksAdded: number;
  booksAlreadyThere: number;
  files: number;
}

export interface StorageBreakdown {
  /** Bytes of e-books, PDFs and documents. */
  books: number;
  audio: number;
  covers: number;
  voices: number;
  /** Re-creatable: narrated chapters. */
  caches: number;
}

export type WorkerRequest =
  | { type: 'import'; jobId: string; items: ImportItem[] }
  | { type: 'cancel'; jobId: string }
  | { type: 'backup'; jobId: string }
  | { type: 'restore'; jobId: string; file: Blob }
  | { type: 'sweep'; jobId: string }
  | { type: 'usage'; jobId: string }
  | { type: 'clear-caches'; jobId: string };

export type WorkerEvent =
  | { type: 'started'; jobId: string; total: number }
  | { type: 'outcome'; jobId: string; outcome: ItemOutcome; done: number; total: number }
  | { type: 'progress'; jobId: string; stage: string; done: number; total: number }
  | { type: 'done'; jobId: string; result?: ImportSummary | RestoreSummary | StorageBreakdown | { blob: Blob; fileName: string } | { removed: number } }
  | { type: 'failed'; jobId: string; message: string };
