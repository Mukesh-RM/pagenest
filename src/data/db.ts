import Dexie, { type Table } from 'dexie';
import {
  SCHEMA_VERSION,
  STORE_SCHEMA,
  type BookRecord,
  type BookmarkRecord,
  type ChapterRecord,
  type CollectionBookRecord,
  type CollectionRecord,
  type HighlightRecord,
  type ProgressRow,
  type RenderRecord,
  type SessionRecord,
  type SettingRecord,
  type TrackRecord,
  type VoiceRecord,
} from './schema';

/** The InkQuiet IndexedDB database (blueprint sections 11 and 13). */
export class PageNestDB extends Dexie {
  books!: Table<BookRecord, string>;
  tracks!: Table<TrackRecord, [string, number]>;
  chapters!: Table<ChapterRecord, [string, number]>;
  progress!: Table<ProgressRow, [string, string]>;
  bookmarks!: Table<BookmarkRecord, string>;
  highlights!: Table<HighlightRecord, string>;
  collections!: Table<CollectionRecord, string>;
  collectionBooks!: Table<CollectionBookRecord, [string, string]>;
  sessions!: Table<SessionRecord, string>;
  voices!: Table<VoiceRecord, string>;
  renders!: Table<RenderRecord, [string, number, string, string]>;
  settings!: Table<SettingRecord, string>;

  constructor(name = 'pagenest') {
    super(name);
    this.version(SCHEMA_VERSION).stores({ ...STORE_SCHEMA });
  }
}

/** Create a new random record id. */
export function newId(): string {
  return crypto.randomUUID();
}

let shared: PageNestDB | undefined;

/** The app-wide database. Created on first use so tests can build their own. */
export function getDb(): PageNestDB {
  shared ??= new PageNestDB();
  return shared;
}
