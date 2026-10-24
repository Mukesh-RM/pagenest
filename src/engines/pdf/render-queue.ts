/**
 * A small priority queue for page and tile renders: at most `concurrency` run at once, the most important runs
 * first, and work that scrolled out of view is cancelled instead of finishing for nothing.
 */

export interface RenderJob<T = void> {
  readonly key: string;
  /** Lower runs first (0 is the page being read). */
  priority: number;
  /** Does the work. Must stop early (reject or resolve) when `signal` aborts. */
  run(signal: AbortSignal): Promise<T>;
}

interface Entry {
  job: RenderJob<unknown>;
  controller: AbortController;
  running: boolean;
  done: Promise<void>;
  resolve: () => void;
}

export class RenderQueue {
  readonly #concurrency: number;
  readonly #entries = new Map<string, Entry>();
  #running = 0;
  #closed = false;

  constructor(concurrency = 2) {
    this.#concurrency = Math.max(1, concurrency);
  }

  /** Queue a job, or update the priority of the job with the same key. Resolves when it finished or was cancelled. */
  enqueue<T>(job: RenderJob<T>): Promise<void> {
    if (this.#closed) return Promise.resolve();
    const existing = this.#entries.get(job.key);
    if (existing) {
      existing.job.priority = job.priority;
      return existing.done;
    }
    let resolve!: () => void;
    const done = new Promise<void>((r) => (resolve = r));
    this.#entries.set(job.key, { job, controller: new AbortController(), running: false, done, resolve });
    queueMicrotask(() => this.#pump());
    return done;
  }

  has(key: string): boolean {
    return this.#entries.has(key);
  }

  get size(): number {
    return this.#entries.size;
  }

  /** Cancel jobs for which `shouldCancel(key)` is true. Running jobs are aborted; waiting jobs are dropped. */
  cancelWhere(shouldCancel: (key: string) => boolean): void {
    for (const [key, entry] of [...this.#entries]) {
      if (!shouldCancel(key)) continue;
      entry.controller.abort();
      if (!entry.running) {
        this.#entries.delete(key);
        entry.resolve();
      }
    }
  }

  close(): void {
    this.#closed = true;
    this.cancelWhere(() => true);
  }

  #pump(): void {
    while (this.#running < this.#concurrency) {
      let next: Entry | undefined;
      for (const entry of this.#entries.values()) {
        if (entry.running) continue;
        if (!next || entry.job.priority < next.job.priority) next = entry;
      }
      if (!next) return;
      const entry = next;
      entry.running = true;
      this.#running++;
      void entry.job
        .run(entry.controller.signal)
        .catch(() => undefined)
        .finally(() => {
          this.#running--;
          this.#entries.delete(entry.job.key);
          entry.resolve();
          this.#pump();
        });
    }
  }
}
