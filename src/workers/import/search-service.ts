import MiniSearch from 'minisearch';

/** The fields of a book that people search by. */
export interface SearchDoc {
  id: string;
  title: string;
  author: string;
  narrator: string;
  series: string;
  format: string;
}

/** Lower-case and drop accents, so "cafe" finds "Café" and "STRASSE" finds "Straße". */
export function normalizeTerm(term: string): string {
  return term
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/ß/g, 'ss')
    .toLowerCase();
}

/**
 * Full-text search over titles, authors, narrators and series (MiniSearch, MIT). Runs in
 * `search.worker.ts`; the same class backs the in-process fallback and the tests.
 */
export class SearchService {
  private readonly index = new MiniSearch<SearchDoc>({
    fields: ['title', 'author', 'narrator', 'series', 'format'],
    storeFields: [],
    processTerm: (term) => normalizeTerm(term) || null,
    searchOptions: { prefix: true, fuzzy: (term: string) => (term.length > 3 ? 0.2 : false), boost: { title: 2, author: 1.2 }, combineWith: 'AND' },
  });

  /** Apply a change: documents to add or replace, ids to drop. */
  sync(add: readonly SearchDoc[], remove: readonly string[]): void {
    for (const id of remove) if (this.index.has(id)) this.index.discard(id);
    for (const doc of add) {
      if (this.index.has(doc.id)) this.index.discard(doc.id);
      this.index.add(doc);
    }
    // Discarded documents are cleaned up in the background by MiniSearch; vacuum when many piled up.
    if (this.index.dirtCount > 200) void this.index.vacuum();
  }

  /** Ids of matching books, best match first. */
  search(query: string): string[] {
    const text = query.trim();
    if (text === '') return [];
    return this.index.search(text).map((r) => String(r.id));
  }

  get size(): number {
    return this.index.documentCount;
  }
}

export type SearchRequest =
  | { type: 'sync'; add: SearchDoc[]; remove: string[] }
  | { type: 'search'; id: number; query: string };

export type SearchResponse = { type: 'result'; id: number; ids: string[] };
