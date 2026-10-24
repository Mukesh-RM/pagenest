import { SearchService, type SearchRequest, type SearchResponse } from '@/workers/import/search-service';

/** Same behavior as the search worker, in the calling thread. Loaded only when workers are missing, and by tests. */
export function createInProcessHandler(): (request: SearchRequest) => SearchResponse | undefined {
  const service = new SearchService();
  return (request) => {
    if (request.type === 'sync') {
      service.sync(request.add, request.remove);
      return undefined;
    }
    return { type: 'result', id: request.id, ids: service.search(request.query) };
  };
}
