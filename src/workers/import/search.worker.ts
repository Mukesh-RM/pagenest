import { SearchService, type SearchRequest, type SearchResponse } from './search-service';

/** Search worker: builds and queries the MiniSearch index off the main thread. */
const service = new SearchService();

self.addEventListener('message', (event: MessageEvent<SearchRequest>) => {
  const request = event.data;
  if (request.type === 'sync') {
    service.sync(request.add, request.remove);
    return;
  }
  const response: SearchResponse = { type: 'result', id: request.id, ids: service.search(request.query) };
  (self as unknown as { postMessage: (m: SearchResponse) => void }).postMessage(response);
});
