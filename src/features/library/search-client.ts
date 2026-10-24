import type { StoredBook } from '@/workers/import/protocol';
import type { SearchDoc, SearchRequest, SearchResponse } from '@/workers/import/search-service';

/** Where search requests go: the search worker, or an in-process service when workers are missing. */
export interface SearchPort {
  post(request: SearchRequest): void;
  onResult(listener: (response: SearchResponse) => void): void;
}

function toDoc(book: StoredBook): SearchDoc {
  return {
    id: book.id,
    title: book.title,
    author: book.author ?? '',
    narrator: book.narrator ?? '',
    series: book.series ?? '',
    format: book.format,
  };
}

function signature(doc: SearchDoc): string {
  return `${doc.title}\u0000${doc.author}\u0000${doc.narrator}\u0000${doc.series}\u0000${doc.format}`;
}

/** Keeps the worker's index in step with the library, sending only what changed. */
export class SearchClient {
  private readonly known = new Map<string, string>();
  private readonly waiting = new Map<number, (ids: string[]) => void>();
  private nextId = 0;

  constructor(private readonly port: SearchPort) {
    port.onResult((response) => {
      const resolve = this.waiting.get(response.id);
      this.waiting.delete(response.id);
      resolve?.(response.ids);
    });
  }

  /** Bring the index in line with `books`. Cheap when nothing changed. */
  sync(books: readonly StoredBook[]): void {
    const add: SearchDoc[] = [];
    const seen = new Set<string>();
    for (const book of books) {
      const doc = toDoc(book);
      const sig = signature(doc);
      seen.add(doc.id);
      if (this.known.get(doc.id) !== sig) {
        this.known.set(doc.id, sig);
        add.push(doc);
      }
    }
    const remove: string[] = [];
    for (const id of this.known.keys()) {
      if (!seen.has(id)) {
        remove.push(id);
        this.known.delete(id);
      }
    }
    if (add.length > 0 || remove.length > 0) this.port.post({ type: 'sync', add, remove });
  }

  /** Ids of matching books, best match first. */
  search(query: string): Promise<string[]> {
    const id = (this.nextId += 1);
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      this.port.post({ type: 'search', id, query });
    });
  }
}

/** A search client on the search worker. Falls back to searching in this thread if workers fail. */
export function createSearchClient(): SearchClient {
  let listener: ((response: SearchResponse) => void) | undefined;
  let worker: Worker | undefined;
  try {
    worker = new Worker(new URL('../../workers/import/search.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (e: MessageEvent<SearchResponse>) => listener?.(e.data));
  } catch {
    worker = undefined;
  }
  let local: Promise<(request: SearchRequest) => SearchResponse | undefined> | undefined;
  const port: SearchPort = {
    onResult: (l) => {
      listener = l;
    },
    post: (request) => {
      if (worker) {
        worker.postMessage(request);
        return;
      }
      local ??= import('./search-inprocess').then((m) => m.createInProcessHandler());
      void local.then((handle) => {
        const response = handle(request);
        if (response) listener?.(response);
      });
    },
  };
  return new SearchClient(port);
}
