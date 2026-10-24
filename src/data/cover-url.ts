/**
 * Cover images as `blob:` URLs, with the clean-up done for you.
 *
 * An `<img>` needs a URL, `URL.createObjectURL` keeps the whole image in memory until it is
 * revoked, and a library of 5,000 books must not keep 5,000 images alive. This cache makes one
 * URL per cover, counts who is using it, keeps recently used ones for a while so scrolling back
 * is instant, and revokes the rest.
 *
 * Main thread only (it needs `URL`). The bytes come from `load`, normally `data.books.getCover`,
 * which reads them in the worker.
 */

export interface CoverLease {
  /** `blob:` URL to put in `<img src>`. Valid until {@link CoverLease.release}. */
  readonly url: string;
  /** Say you are done (the image left the screen). Safe to call more than once. */
  release(): void;
}

export interface CoverUrlCacheOptions {
  /** Fetch the image bytes for a book; `undefined` when it has no cover. */
  readonly load: (bookId: string) => Promise<Blob | undefined>;
  /** How many unused covers to keep ready. Default 120. */
  readonly maxIdle?: number;
  readonly createObjectURL?: (blob: Blob) => string;
  readonly revokeObjectURL?: (url: string) => void;
}

interface Entry {
  readonly url: string;
  refs: number;
  /** Replaced or dropped while still in use: revoke when the last user lets go. */
  retired: boolean;
}

export class CoverUrlCache {
  private readonly entries = new Map<string, Entry>();
  /** Entries nobody uses, oldest first. */
  private readonly idle = new Set<string>();
  private readonly loading = new Map<string, Promise<Entry | undefined>>();
  private readonly generation = new Map<string, number>();
  /** Entries replaced while still shown; revoked when their last user releases. */
  private readonly retiredInUse = new Set<Entry>();
  private readonly maxIdle: number;
  private readonly create: (blob: Blob) => string;
  private readonly revoke: (url: string) => void;
  private disposed = false;

  constructor(private readonly options: CoverUrlCacheOptions) {
    this.maxIdle = options.maxIdle ?? 120;
    this.create = options.createObjectURL ?? ((b) => URL.createObjectURL(b));
    this.revoke = options.revokeObjectURL ?? ((u) => URL.revokeObjectURL(u));
  }

  /** Number of URLs currently alive (in use or kept ready). For tests and the memory screen. */
  get size(): number {
    return this.entries.size + this.retiredInUse.size;
  }

  /** Get a URL for the book's cover, or `undefined` if it has none. Release the lease when the image is no longer shown. */
  async acquire(bookId: string): Promise<CoverLease | undefined> {
    if (this.disposed) return undefined;
    let entry = await this.entryFor(bookId);
    // The cover may be replaced or the cache closed between loading and now; never hand out a revoked URL.
    while (entry && !this.disposed && this.entries.get(bookId) !== entry) entry = await this.entryFor(bookId);
    if (!entry || this.disposed) return undefined;
    entry.refs += 1;
    this.idle.delete(bookId);
    let released = false;
    return {
      url: entry.url,
      release: () => {
        if (released) return;
        released = true;
        this.letGo(bookId, entry);
      },
    };
  }

  /** The cover changed or was removed: the next `acquire` loads the new image. Holders of the old URL keep it until they release. */
  invalidate(bookId: string): void {
    this.generation.set(bookId, (this.generation.get(bookId) ?? 0) + 1);
    this.loading.delete(bookId);
    const entry = this.entries.get(bookId);
    if (!entry) return;
    this.entries.delete(bookId);
    this.idle.delete(bookId);
    if (entry.refs === 0) this.revoke(entry.url);
    else {
      entry.retired = true;
      this.retiredInUse.add(entry);
    }
  }

  /** Revoke everything. Call when the library screen goes away for good. */
  dispose(): void {
    this.disposed = true;
    for (const entry of this.entries.values()) this.revoke(entry.url);
    for (const entry of this.retiredInUse) this.revoke(entry.url);
    this.entries.clear();
    this.retiredInUse.clear();
    this.idle.clear();
    this.loading.clear();
  }

  private entryFor(bookId: string): Promise<Entry | undefined> {
    const existing = this.entries.get(bookId);
    if (existing) return Promise.resolve(existing);
    const inFlight = this.loading.get(bookId);
    if (inFlight) return inFlight;
    const generation = this.generation.get(bookId) ?? 0;
    const promise = (async (): Promise<Entry | undefined> => {
      const blob = await this.options.load(bookId);
      if (!blob || this.disposed) return undefined;
      if ((this.generation.get(bookId) ?? 0) !== generation) {
        // Changed while loading: this image is already out of date.
        return this.entryFor(bookId);
      }
      const entry: Entry = { url: this.create(blob), refs: 0, retired: false };
      this.entries.set(bookId, entry);
      return entry;
    })().finally(() => {
      if (this.loading.get(bookId) === promise) this.loading.delete(bookId);
    });
    this.loading.set(bookId, promise);
    return promise;
  }

  private letGo(bookId: string, entry: Entry): void {
    entry.refs -= 1;
    if (entry.refs > 0) return;
    if (entry.retired) {
      // After dispose() it is already revoked; only revoke once.
      if (this.retiredInUse.delete(entry)) this.revoke(entry.url);
      return;
    }
    if (this.disposed) return;
    this.idle.add(bookId);
    while (this.idle.size > this.maxIdle) {
      const oldest = this.idle.values().next().value as string;
      this.idle.delete(oldest);
      const old = this.entries.get(oldest);
      if (old && old.refs === 0) {
        this.entries.delete(oldest);
        this.revoke(old.url);
      }
    }
  }
}
