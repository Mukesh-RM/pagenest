/** In-memory CacheStorage for unit tests (jsdom and Node have no Cache API). Not imported by the app. */
class MemoryCache {
  private readonly entries = new Map<string, Response>();

  async put(request: Request | string, response: Response): Promise<void> {
    this.entries.set(typeof request === 'string' ? request : request.url, response);
  }
  async match(request: Request | string): Promise<Response | undefined> {
    const hit = this.entries.get(typeof request === 'string' ? request : request.url);
    return hit ? hit.clone() : undefined;
  }
  async keys(): Promise<Request[]> {
    return [...this.entries.keys()].map((url) => new Request(url));
  }
}

export class MemoryCacheStorage {
  private readonly caches = new Map<string, MemoryCache>();

  async open(name: string): Promise<Cache> {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new MemoryCache();
      this.caches.set(name, cache);
    }
    return cache as unknown as Cache;
  }
  async has(name: string): Promise<boolean> {
    return this.caches.has(name);
  }
  async delete(name: string): Promise<boolean> {
    return this.caches.delete(name);
  }
  asCacheStorage(): CacheStorage {
    return this as unknown as CacheStorage;
  }
}
