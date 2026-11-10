import MiniSearch from 'minisearch';
import type { PageNestDB } from '@/data/db';
import { getSetting, setSetting } from '@/data/settings';
import type { Locator } from '@/app/contracts';
import type { SearchHit } from '@/engines/reader/types';
import { findMatches, excerptAround, type SearchOptions } from '../core/search';
import type { ReaderDocumentExt } from '../core/ext-types';

const CHUNK = 480;
const BLURB_CHARS = 12_000;
const INDEX_KEY = (bookId: string) => `bookSearch.${bookId}`;

export interface StoredBookSearchIndex {
  readonly fingerprint: string;
  readonly blurb: string;
  readonly mini: ReturnType<MiniSearch['toJSON']>;
}

interface IndexChunk {
  readonly id: string;
  readonly sectionIndex: number;
  readonly start: number;
  readonly text: string;
}

interface WalkableDoc extends ReaderDocumentExt {
  walkSectionsForIndex?(signal?: AbortSignal): AsyncGenerator<{ sectionIndex: number; text: string }>;
}

function chunkSection(sectionIndex: number, text: string): IndexChunk[] {
  const chunks: IndexChunk[] = [];
  for (let start = 0; start < text.length; start += CHUNK) {
    const slice = text.slice(start, start + CHUNK);
    if (!slice.trim()) continue;
    chunks.push({ id: `s${sectionIndex}:${start}`, sectionIndex, start, text: slice });
  }
  return chunks;
}

function buildMini(chunks: readonly IndexChunk[]): MiniSearch<IndexChunk> {
  const mini = new MiniSearch<IndexChunk>({
    fields: ['text'],
    storeFields: ['sectionIndex', 'start', 'text'],
    searchOptions: { prefix: true, fuzzy: 0.15 },
  });
  mini.addAll(chunks as IndexChunk[]);
  return mini;
}

export async function loadBookSearchIndex(db: PageNestDB, bookId: string): Promise<StoredBookSearchIndex | undefined> {
  const row = await getSetting<StoredBookSearchIndex>(db, INDEX_KEY(bookId)).catch(() => undefined);
  return row && row.mini ? row : undefined;
}

async function persistBookSearchIndex(db: PageNestDB, bookId: string, stored: StoredBookSearchIndex): Promise<void> {
  await setSetting(db, INDEX_KEY(bookId), stored);
}

/** Build or refresh the MiniSearch index in the background (yields between sections). */
export async function scheduleBookSearchIndex(
  db: PageNestDB,
  bookId: string,
  fingerprint: string,
  doc: ReaderDocumentExt,
  signal?: AbortSignal,
): Promise<void> {
  const walkable = doc as WalkableDoc;
  if (!walkable.walkSectionsForIndex) return;
  const existing = await loadBookSearchIndex(db, bookId);
  if (existing?.fingerprint === fingerprint) return;

  const chunks: IndexChunk[] = [];
  let blurb = '';
  for await (const { sectionIndex, text } of walkable.walkSectionsForIndex(signal)) {
    if (signal?.aborted) return;
    if (blurb.length < BLURB_CHARS) blurb += (blurb ? ' ' : '') + text.slice(0, BLURB_CHARS - blurb.length);
    chunks.push(...chunkSection(sectionIndex, text));
    if (chunks.length % 40 === 0) await new Promise<void>((r) => setTimeout(r, 0));
  }
  if (!chunks.length) return;
  const mini = buildMini(chunks);
  await persistBookSearchIndex(db, bookId, {
    fingerprint,
    blurb: blurb.slice(0, BLURB_CHARS),
    mini: mini.toJSON(),
  });
}

function reflowLocator(sectionIndex: number, offset: number): Locator {
  return { kind: 'reflow', section: sectionIndex, textOffset: offset };
}

function hitsFromMini(mini: MiniSearch<IndexChunk>, query: string, limit: number, opts: SearchOptions = {}): SearchHit[] {
  const found = mini.search(query, { combineWith: 'AND' }).slice(0, limit);
  const hits: SearchHit[] = [];
  for (const row of found) {
    const sectionIndex = row.sectionIndex as number;
    const start = row.start as number;
    const text = row.text as string;
    const localMatches = findMatches(text, query, opts);
    for (const m of localMatches) {
      const globalStart = start + m.start;
      const globalEnd = start + m.end;
      const range = { start: reflowLocator(sectionIndex, globalStart), end: reflowLocator(sectionIndex, globalEnd) };
      const excerpt = excerptAround(text, { start: m.start, end: m.end });
      hits.push({ range, ...excerpt });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}

/** Fast path when a persisted MiniSearch index exists; otherwise returns `undefined`. */
export async function searchWithBookIndex(
  db: PageNestDB,
  bookId: string,
  query: string,
  limit = 80,
  signal?: AbortSignal,
): Promise<SearchHit[] | undefined> {
  if (signal?.aborted) return [];
  const stored = await loadBookSearchIndex(db, bookId);
  if (!stored) return undefined;
  const mini = MiniSearch.loadJSON<IndexChunk>(JSON.stringify(stored.mini), {
    fields: ['text'],
    storeFields: ['sectionIndex', 'start', 'text'],
  });
  return hitsFromMini(mini, query.trim(), limit);
}
