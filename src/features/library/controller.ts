import { createStore, type StoreApi } from 'zustand/vanilla';
import type { PageNestDB } from '@/data/db';
import { FilePaths, type FileStore } from '@/data/opfs';
import { getSetting, setSetting } from '@/data/settings';
import type { ImportItem, ImportSummary, ItemOutcome, StoredBook, WorkerEvent } from '@/workers/import/protocol';
import type { ImportClient } from './import-client';
import { DEFAULT_PREFS, parsePrefs, type FilterChip, type LibraryPrefs } from './model';
import { normalizeBook } from './normalize';
import type { SearchClient } from './search-client';

export const PREFS_KEY = 'library.prefs';
const LOAD_CHUNK = 500;
const FLUSH_MS = 150;
const SEARCH_EMPTY: readonly string[] = [];

/** One file that could not be added, with the reason in plain words. */
export interface ImportProblem {
  name: string;
  message: string;
}

/** Everything a person sees about the imports running (or just finished). */
export interface ImportRun {
  total: number;
  done: number;
  added: number;
  duplicates: number;
  problems: ImportProblem[];
  active: boolean;
  /** Title of the most recently added book, for the "Added" line. */
  lastTitle?: string;
}

export interface LibraryState {
  phase: 'loading' | 'ready';
  /** Every book, in no particular order. Use `selectBooks` to order and filter. */
  books: readonly StoredBook[];
  /** Best saved progress per book, 0 to 100. */
  percents: ReadonlyMap<string, number>;
  prefs: LibraryPrefs;
  chip: FilterChip | null;
  query: string;
  /** Ids from the search worker for `query`; `null` when there is no search. */
  searchIds: readonly string[] | null;
  selection: ReadonlySet<string>;
  run: ImportRun | null;
  /** A short plain-words message about something that did not work (shown once). */
  notice: string | null;
}

export interface LibraryDeps {
  db: PageNestDB;
  getFiles: () => Promise<FileStore>;
  imports: ImportClient;
  search: SearchClient;
  /** Called after the first successful import in a session. */
  requestPersistence?: () => Promise<unknown>;
  takeSharedFiles?: () => Promise<File[]>;
  /** Milliseconds before a deleted book's files are removed. Default 9000 (just over the Undo window). */
  now?: () => number;
}

/** What `deleteBooks` returns: `undo` puts everything back, `commit` removes the files for good. */
export interface DeleteHandle {
  count: number;
  undo(): Promise<void>;
  commit(): Promise<void>;
}

const emptyRun = (): ImportRun => ({ total: 0, done: 0, added: 0, duplicates: 0, problems: [], active: false });

function initial(): LibraryState {
  return {
    phase: 'loading',
    books: [],
    percents: new Map(),
    prefs: DEFAULT_PREFS,
    chip: null,
    query: '',
    searchIds: null,
    selection: new Set(),
    run: null,
    notice: null,
  };
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * The Library's brain: loads books in chunks, keeps them in step with the database, runs imports in
 * the worker, and applies edits to the screen first and the database second (optimistic), undoing
 * the screen change and saying so in plain words if the database refuses.
 */
export class LibraryController {
  readonly store: StoreApi<LibraryState>;
  private readonly byId = new Map<string, StoredBook>();
  private pendingAdded: StoredBook[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private run: ImportRun | null = null;
  private readonly jobTotals = new Map<string, number>();
  private readonly jobDone = new Map<string, number>();
  private persistAsked = false;
  private searchSeq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private loaded: Promise<void> | undefined;
  private refreshIds = new Set<string>();
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;

  constructor(private readonly deps: LibraryDeps) {
    this.store = createStore<LibraryState>(initial);
  }

  get state(): LibraryState {
    return this.store.getState();
  }

  private set(patch: Partial<LibraryState>): void {
    this.store.setState(patch);
  }

  /** Load preferences, books and progress. Safe to call more than once. */
  load(): Promise<void> {
    this.loaded ??= this.doLoad();
    return this.loaded;
  }

  private async doLoad(): Promise<void> {
    const { db } = this.deps;
    try {
      const saved = await getSetting<unknown>(db, PREFS_KEY);
      this.set({ prefs: parsePrefs(saved) });
    } catch {
      /* default preferences are fine */
    }
    try {
      let offset = 0;
      for (;;) {
        const rows = await db.books.orderBy('addedAt').reverse().offset(offset).limit(LOAD_CHUNK).toArray();
        this.absorb(rows);
        if (offset === 0) this.set({ phase: 'ready' });
        if (rows.length < LOAD_CHUNK) break;
        offset += rows.length;
        await tick(); // let the screen paint between chunks
      }
      // Rows without `addedAt` are not in that index; pick them up with a plain scan.
      const total = await db.books.count();
      if (total > this.byId.size) {
        const rows = await db.books.toArray();
        this.absorb(rows.filter((r) => !this.byId.has(r.id)));
      }
    } catch {
      this.set({ notice: 'Your library could not be read. Close other PageNest tabs and try again.' });
    }
    this.set({ phase: 'ready' });
    try {
      const percents = new Map<string, number>();
      const rows = await db.progress.toArray();
      for (const row of rows) percents.set(row.bookId, Math.max(percents.get(row.bookId) ?? 0, row.percent));
      this.set({ percents });
    } catch {
      /* no progress bars is better than no library */
    }
    this.syncSearch();
  }

  /** Add or replace books in memory (one store update per call). */
  private absorb(rows: readonly StoredBook[]): void {
    if (rows.length === 0) return;
    for (const row of rows) this.byId.set(row.id, normalizeBook(row));
    this.set({ books: [...this.byId.values()] });
    this.syncSearch();
  }

  private syncSearch(): void {
    // Keep the index warm so the first search answers at once.
    this.deps.search.sync(this.state.books);
  }

  /** Follow changes other parts of the app make to books and progress. Returns a stop function. */
  watch(): () => void {
    const { db } = this.deps;
    const onBook = (id: string): void => this.queueRefresh(id);
    const creating = (primKey: unknown, obj: { id?: string }): void => onBook(String(primKey ?? obj.id));
    const updating = (_mods: unknown, primKey: unknown): void => onBook(String(primKey));
    const deleting = (primKey: unknown): void => onBook(String(primKey));
    db.books.hook('creating', creating as never);
    db.books.hook('updating', updating as never);
    db.books.hook('deleting', deleting as never);
    const progress = (_p: unknown, obj: { bookId?: string }): void => {
      if (obj?.bookId) this.queueRefresh(obj.bookId);
    };
    const progressCreating = (_k: unknown, obj: { bookId?: string }): void => progress(null, obj);
    const progressUpdating = (_m: unknown, _k: unknown, obj: { bookId?: string }): void => progress(null, obj);
    db.progress.hook('creating', progressCreating as never);
    db.progress.hook('updating', progressUpdating as never);
    return () => {
      db.books.hook('creating').unsubscribe(creating as never);
      db.books.hook('updating').unsubscribe(updating as never);
      db.books.hook('deleting').unsubscribe(deleting as never);
      db.progress.hook('creating').unsubscribe(progressCreating as never);
      db.progress.hook('updating').unsubscribe(progressUpdating as never);
    };
  }

  private queueRefresh(id: string): void {
    this.refreshIds.add(id);
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => void this.refresh(), 120);
  }

  private async refresh(): Promise<void> {
    if (this.disposed) return;
    const ids = [...this.refreshIds];
    this.refreshIds.clear();
    try {
      const { db } = this.deps;
      const rows = await db.books.bulkGet(ids);
      let changed = false;
      ids.forEach((id, i) => {
        const row = rows[i];
        if (row) {
          this.byId.set(id, normalizeBook(row));
          changed = true;
        } else if (this.byId.delete(id)) changed = true;
      });
      if (changed) {
        this.set({ books: [...this.byId.values()] });
        this.syncSearch();
      }
      const percents = new Map(this.state.percents);
      for (const id of ids) {
        const progress = await db.progress.where('bookId').equals(id).toArray();
        if (progress.length > 0) percents.set(id, Math.max(...progress.map((p) => p.percent)));
        else percents.delete(id);
      }
      this.set({ percents });
    } catch {
      /* a refresh that fails leaves the screen as it was */
    }
  }

  dispose(): void {
    this.disposed = true;
    clearTimeout(this.flushTimer);
    clearTimeout(this.searchTimer);
    clearTimeout(this.refreshTimer);
  }

  // ---------- view state ----------

  setPrefs(patch: Partial<LibraryPrefs>): void {
    const prefs = { ...this.state.prefs, ...patch };
    this.set({ prefs });
    void setSetting(this.deps.db, PREFS_KEY, prefs).catch(() => undefined);
  }

  setChip(chip: FilterChip | null): void {
    this.set({ chip });
  }

  /** Update the search text and ask the worker. No debounce: the worker answers in a few ms. */
  setQuery(query: string): void {
    this.set({ query });
    const text = query.trim();
    if (text === '') {
      this.searchSeq += 1;
      this.set({ searchIds: null });
      return;
    }
    const seq = (this.searchSeq += 1);
    this.syncSearch();
    void this.deps.search.search(text).then((ids) => {
      if (seq === this.searchSeq && !this.disposed) this.set({ searchIds: ids.length === 0 ? SEARCH_EMPTY : ids });
    });
  }

  toggleSelected(id: string): void {
    const next = new Set(this.state.selection);
    if (!next.delete(id)) next.add(id);
    this.set({ selection: next });
  }

  selectAll(ids: readonly string[]): void {
    this.set({ selection: new Set(ids) });
  }

  clearSelection(): void {
    if (this.state.selection.size > 0) this.set({ selection: new Set() });
  }

  clearNotice(): void {
    if (this.state.notice !== null) this.set({ notice: null });
  }

  // ---------- importing ----------

  /**
   * Start importing. Progress and results arrive through the store; the promise settles when this
   * batch is finished (it never rejects: problems are listed in the run).
   */
  importFiles(items: ImportItem[], onOutcome?: (outcome: ItemOutcome) => void): Promise<void> {
    if (items.length === 0) return Promise.resolve();
    this.run ??= emptyRun();
    this.run.active = true;
    const job = this.deps.imports.run<ImportSummary>({ type: 'import', items }, (event) => {
      this.onImportEvent(event);
      if (event.type === 'outcome') onOutcome?.(event.outcome);
    });
    this.jobTotals.set(job.jobId, items.length);
    this.jobDone.set(job.jobId, 0);
    this.recount();
    this.publishRun();
    this.currentJob = job;
    return job.done.then(
      () => this.finishJob(job.jobId),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
        this.run?.problems.push({ name: '', message });
        this.finishJob(job.jobId);
      },
    );
  }

  private currentJob: { cancel(): void } | undefined;

  cancelImport(): void {
    this.currentJob?.cancel();
  }

  private recount(): void {
    if (!this.run) return;
    let total = 0;
    let done = 0;
    for (const v of this.jobTotals.values()) total += v;
    for (const v of this.jobDone.values()) done += v;
    this.run.total = total;
    this.run.done = done;
  }

  private onImportEvent(event: WorkerEvent): void {
    if (!this.run) return;
    if (event.type === 'started') {
      this.jobTotals.set(event.jobId, event.total);
    } else if (event.type === 'outcome') {
      this.jobTotals.set(event.jobId, event.total);
      this.jobDone.set(event.jobId, event.done);
      this.applyOutcome(event.outcome);
    }
    this.recount();
    this.schedulePublish();
  }

  private applyOutcome(outcome: ItemOutcome): void {
    const run = this.run;
    if (!run) return;
    if (outcome.status === 'added') {
      run.added += 1;
      run.lastTitle = outcome.book.title;
      this.pendingAdded.push(outcome.book);
    } else if (outcome.status === 'duplicate') {
      run.duplicates += 1;
    } else if (outcome.status === 'unsupported') {
      run.problems.push({ name: outcome.name, message: outcome.message });
    }
  }

  private schedulePublish(): void {
    if (this.flushTimer !== undefined) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      this.publishRun();
    }, FLUSH_MS);
  }

  private publishRun(): void {
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    if (this.disposed) return;
    const added = this.pendingAdded;
    this.pendingAdded = [];
    if (added.length > 0) this.absorb(added);
    if (this.run) this.set({ run: { ...this.run, problems: [...this.run.problems] } });
  }

  private finishJob(jobId: string): void {
    if (!this.run) return;
    this.jobDone.set(jobId, this.jobTotals.get(jobId) ?? 0);
    const stillRunning = [...this.jobTotals.keys()].some((id) => (this.jobDone.get(id) ?? 0) < (this.jobTotals.get(id) ?? 0) && id !== jobId);
    this.recount();
    if (!stillRunning) this.run.active = false;
    this.publishRun();
    if (this.run.added > 0 && !this.persistAsked) {
      this.persistAsked = true;
      void this.deps.requestPersistence?.().catch(() => undefined);
    }
  }

  /** Close the import summary. A new import then starts a fresh one. */
  dismissRun(): void {
    if (this.run?.active) return;
    this.run = null;
    this.jobTotals.clear();
    this.jobDone.clear();
    this.set({ run: null });
  }

  /** Import whatever was shared to the app (Android share sheet). Returns how many files were taken. */
  async importShared(): Promise<number> {
    const take = this.deps.takeSharedFiles;
    if (!take) return 0;
    let files: File[] = [];
    try {
      files = await take();
    } catch {
      this.set({ notice: 'The shared files could not be read. Please share them again.' });
      return 0;
    }
    void this.importFiles(files.map((file) => ({ file })));
    return files.length;
  }

  /** Remove files left behind by interrupted imports or deletes. Quiet: no result shown. */
  sweep(): void {
    this.deps.imports.run({ type: 'sweep' }).done.catch(() => undefined);
  }

  // ---------- edits ----------

  private replace(id: string, patch: Partial<StoredBook>): StoredBook | undefined {
    const before = this.byId.get(id);
    if (!before) return undefined;
    this.byId.set(id, { ...before, ...patch });
    this.set({ books: [...this.byId.values()] });
    return before;
  }

  private async persist(id: string, patch: Partial<StoredBook>, before: StoredBook | undefined): Promise<boolean> {
    try {
      await this.deps.db.books.update(id, patch);
      return true;
    } catch {
      if (before) {
        this.byId.set(id, before);
        this.set({ books: [...this.byId.values()], notice: 'That change could not be saved. Please try again.' });
      }
      return false;
    }
  }

  async toggleFavorite(id: string): Promise<void> {
    const book = this.byId.get(id);
    if (!book) return;
    const patch = { favorite: !book.favorite };
    await this.persist(id, patch, this.replace(id, patch));
  }

  async setFinished(ids: readonly string[], finished: boolean): Promise<void> {
    await Promise.all(
      ids.map(async (id) => {
        const patch = { finished };
        await this.persist(id, patch, this.replace(id, patch));
      }),
    );
  }

  async setFavorite(ids: readonly string[], favorite: boolean): Promise<void> {
    await Promise.all(
      ids.map(async (id) => {
        const patch = { favorite };
        await this.persist(id, patch, this.replace(id, patch));
      }),
    );
  }

  /** Edit the title and author. Returns a plain-words problem, or `undefined` when saved. */
  async editDetails(id: string, details: { title: string; author: string }): Promise<string | undefined> {
    const title = details.title.trim().replace(/\s+/g, ' ');
    if (title === '') return 'A book needs a title.';
    if (title.length > 300) return 'That title is too long.';
    const author = details.author.trim().replace(/\s+/g, ' ');
    const book = this.byId.get(id);
    if (!book) return 'That book is no longer in your library.';
    const { author: _oldAuthor, ...rest } = book;
    const next: StoredBook = { ...rest, title, ...(author === '' ? {} : { author }) };
    this.byId.set(id, next);
    this.set({ books: [...this.byId.values()] });
    this.syncSearch();
    try {
      await this.deps.db.transaction('rw', this.deps.db.books, async () => {
        const row = await this.deps.db.books.get(id);
        if (!row) return;
        const { author: _a, ...others } = row;
        await this.deps.db.books.put({ ...others, title, ...(author === '' ? {} : { author }) });
      });
      return undefined;
    } catch {
      this.byId.set(id, book);
      this.set({ books: [...this.byId.values()] });
      this.syncSearch();
      return 'That change could not be saved. Please try again.';
    }
  }

  /** Use a picture as a book's cover (for example a PDF's first page from the Reader). */
  async setCover(bookId: string, image: Blob): Promise<void> {
    const files = await this.deps.getFiles();
    const ref = FilePaths.cover(bookId);
    await files.write(ref, image);
    const patch = { coverRef: ref };
    await this.persist(bookId, patch, this.replace(bookId, patch));
    coverVersion.set(bookId, (coverVersion.get(bookId) ?? 0) + 1);
  }

  // ---------- deleting ----------

  /**
   * Remove books everywhere: the screen at once, then the database rows. Files stay until
   * `commit()` so Undo can bring everything back.
   */
  async deleteBooks(ids: readonly string[]): Promise<DeleteHandle> {
    const { db } = this.deps;
    const books = ids.map((id) => this.byId.get(id)).filter((b): b is StoredBook => b !== undefined);
    const gone = new Set(books.map((b) => b.id));
    for (const id of gone) this.byId.delete(id);
    const selection = new Set(this.state.selection);
    for (const id of gone) selection.delete(id);
    this.set({ books: [...this.byId.values()], selection });
    this.syncSearch();

    const keys = [...gone];
    const related = await db
      .transaction('rw', [db.books, db.tracks, db.chapters, db.progress, db.bookmarks, db.highlights, db.collectionBooks, db.sessions, db.renders], async () => {
        const snapshot = {
          rows: await db.books.bulkGet(keys),
          tracks: await db.tracks.where('bookId').anyOf(keys).toArray(),
          chapters: await db.chapters.where('bookId').anyOf(keys).toArray(),
          progress: await db.progress.where('bookId').anyOf(keys).toArray(),
          bookmarks: await db.bookmarks.where('bookId').anyOf(keys).toArray(),
          highlights: await db.highlights.where('bookId').anyOf(keys).toArray(),
          links: (await db.collectionBooks.toArray()).filter((l) => gone.has(l.bookId)),
          sessions: await db.sessions.where('bookId').anyOf(keys).toArray(),
          renders: await db.renders.where('bookId').anyOf(keys).toArray(),
        };
        await Promise.all([
          db.books.bulkDelete(keys),
          db.tracks.where('bookId').anyOf(keys).delete(),
          db.chapters.where('bookId').anyOf(keys).delete(),
          db.progress.where('bookId').anyOf(keys).delete(),
          db.bookmarks.where('bookId').anyOf(keys).delete(),
          db.highlights.where('bookId').anyOf(keys).delete(),
          db.collectionBooks.bulkDelete(snapshot.links.map((l) => [l.collectionId, l.bookId] as [string, string])),
          db.sessions.where('bookId').anyOf(keys).delete(),
          db.renders.where('bookId').anyOf(keys).delete(),
        ]);
        return snapshot;
      })
      .catch(() => undefined);

    if (!related) {
      // The database refused: put the books back on screen and say so.
      for (const b of books) this.byId.set(b.id, b);
      this.set({ books: [...this.byId.values()], notice: 'Those books could not be removed. Please try again.' });
      return { count: 0, undo: async () => undefined, commit: async () => undefined };
    }
    let settled = false;
    return {
      count: books.length,
      undo: async () => {
        if (settled) return;
        settled = true;
        await db.transaction('rw', [db.books, db.tracks, db.chapters, db.progress, db.bookmarks, db.highlights, db.collectionBooks, db.sessions, db.renders], async () => {
          await db.books.bulkPut(related.rows.filter((r): r is NonNullable<typeof r> => r !== undefined));
          await db.tracks.bulkPut(related.tracks);
          await db.chapters.bulkPut(related.chapters);
          await db.progress.bulkPut(related.progress);
          await db.bookmarks.bulkPut(related.bookmarks);
          await db.highlights.bulkPut(related.highlights);
          await db.collectionBooks.bulkPut(related.links);
          await db.sessions.bulkPut(related.sessions);
          await db.renders.bulkPut(related.renders);
        });
        for (const b of books) this.byId.set(b.id, b);
        const percents = new Map(this.state.percents);
        for (const p of related.progress) percents.set(p.bookId, Math.max(percents.get(p.bookId) ?? 0, p.percent));
        this.set({ books: [...this.byId.values()], percents });
        this.syncSearch();
      },
      commit: async () => {
        if (settled) return;
        settled = true;
        const files = await this.deps.getFiles();
        await Promise.all(
          keys.flatMap((id) => [files.remove(`books/${id}`), files.remove(FilePaths.cover(id)), files.remove(`renders/${id}`)]),
        );
        for (const id of keys) coverVersion.delete(id);
      },
    };
  }
}

/** Bumped when a book's cover file is replaced, so cached pictures are reloaded. */
export const coverVersion = new Map<string, number>();
