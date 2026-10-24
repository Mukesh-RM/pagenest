import type {
  BookFormat,
  BookKind,
  EntityId,
  FileRef,
  Locator,
  ProgressMode,
  TextRange,
} from '@/app/contracts';
import type { HighlightColor } from '@/engines/reader/types';
import type { VoiceEngineId } from '@/engines/tts/types';

/**
 * Record types for every store in blueprint section 13 (Data Model).
 * One interface per store; names follow the blueprint's field lists exactly.
 * Optional fields are those a file may not provide (for example `narrator`).
 */

/** `books`: one library item. */
export interface BookRecord {
  id: EntityId;
  /** File size plus a hash of the first and last megabyte (blueprint section 6). Unique. */
  fingerprint: string;
  kind: BookKind;
  format: BookFormat;
  title: string;
  author?: string;
  narrator?: string;
  series?: string;
  /** BCP 47 language tag. */
  language?: string;
  coverRef?: FileRef;
  /** The book file in OPFS. Audio books with many files use `tracks` instead. */
  fileRef?: FileRef;
  /** Audio only: total length in seconds. */
  durationSec?: number;
  /** Fixed-layout formats: page count. */
  pages?: number;
  /** Epoch milliseconds. */
  addedAt: number;
  lastOpenedAt?: number;
  favorite: boolean;
  finished: boolean;
}

/** `tracks`: one audio file of an audiobook. Primary key is `[bookId+index]`. */
export interface TrackRecord {
  bookId: EntityId;
  index: number;
  fileRef: FileRef;
  title: string;
  durationSec: number;
  /** Seconds from the start of the book to the start of this track. */
  startOffsetSec: number;
}

/**
 * `chapters`: chapter of a book. Primary key is `[bookId+index]`.
 * Text books give a `locator`; audiobooks give `startSec` (seconds from book start).
 */
export interface ChapterRecord {
  bookId: EntityId;
  index: number;
  title: string;
  locator?: Locator;
  startSec?: number;
}

/** `progress`: one saved position per `[bookId+mode]`. */
export interface ProgressRow {
  bookId: EntityId;
  mode: ProgressMode;
  locator: Locator;
  /** 0 to 100. */
  percent: number;
  updatedAt: number;
}

/** `bookmarks`: a named place in a book. */
export interface BookmarkRecord {
  id: EntityId;
  bookId: EntityId;
  locator: Locator;
  label: string;
  createdAt: number;
}

/** `highlights`: a marked passage, optionally with a note. Stored as a range so it survives re-pagination. */
export interface HighlightRecord {
  id: EntityId;
  bookId: EntityId;
  range: TextRange;
  text: string;
  color: HighlightColor;
  note?: string;
  createdAt: number;
}

/** `collections`: a shelf. `order` is the shelf position for drag-to-reorder. */
export interface CollectionRecord {
  id: EntityId;
  name: string;
  order: number;
}

/** `collection_books`: links a book to a shelf. Primary key is `[collectionId+bookId]`. */
export interface CollectionBookRecord {
  collectionId: EntityId;
  bookId: EntityId;
  /** Position of the book within the shelf. */
  order: number;
}

/** `sessions`: one stretch of reading or listening, for Stats. */
export interface SessionRecord {
  id: EntityId;
  bookId: EntityId;
  mode: ProgressMode;
  startedAt: number;
  durationSec: number;
}

/** `voices`: a voice the user can narrate with. */
export interface VoiceRecord {
  id: EntityId;
  name: string;
  engine: VoiceEngineId;
  /** Model file(s) in OPFS; absent for engines without a model (browser speech). */
  modelRef?: FileRef;
  language: string;
  isOwnVoice: boolean;
  createdAt: number;
}

/** Lifecycle of a rendered chapter. */
export type RenderStatus = 'queued' | 'rendering' | 'ready' | 'failed';

/** `renders`: a narrated chapter cached as Opus in OPFS. Primary key is `[bookId+chapterIndex+voiceId+style]`. */
export interface RenderRecord {
  bookId: EntityId;
  chapterIndex: number;
  voiceId: EntityId;
  /** Expression level: `natural`, `expressive` or `cast`. */
  style: NarrationStyle;
  audioRef?: FileRef;
  status: RenderStatus;
}

export type NarrationStyle = 'natural' | 'expressive' | 'cast';

/** `settings`: key and value for themes, fonts, skip times, defaults. */
export interface SettingRecord {
  key: string;
  /** Any JSON-compatible value. */
  value: unknown;
}

/** Names of all stores, in the blueprint's order. */
export const STORE_NAMES = [
  'books',
  'tracks',
  'chapters',
  'progress',
  'bookmarks',
  'highlights',
  'collections',
  'collectionBooks',
  'sessions',
  'voices',
  'renders',
  'settings',
] as const;

export type StoreName = (typeof STORE_NAMES)[number];

/**
 * Dexie index definitions, one string per store. `&` is unique, `[a+b]` is a
 * compound index; the first entry is the primary key. Booleans are not
 * indexable in IndexedDB, so `favorite` and `finished` are filtered in code.
 */
export const STORE_SCHEMA: Readonly<Record<StoreName, string>> = {
  books: 'id, &fingerprint, kind, format, title, author, addedAt, lastOpenedAt',
  tracks: '[bookId+index], bookId',
  chapters: '[bookId+index], bookId',
  progress: '[bookId+mode], bookId, updatedAt',
  bookmarks: 'id, bookId, createdAt',
  highlights: 'id, bookId, createdAt',
  collections: 'id, order',
  collectionBooks: '[collectionId+bookId], collectionId, bookId',
  sessions: 'id, bookId, startedAt',
  voices: 'id, engine, language, createdAt',
  renders: '[bookId+chapterIndex+voiceId+style], bookId, voiceId, status',
  settings: 'key',
};

/** Current Dexie version. Bump with a new `db.version(n).stores(...).upgrade(...)` block on every schema change. */
export const SCHEMA_VERSION = 1;
