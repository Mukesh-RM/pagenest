import { createStore, type StoreApi } from 'zustand/vanilla';
import type { ImportItem, ImportSummary, ItemOutcome, WorkerEvent } from '@/workers/import/protocol';
import type { ImportClient } from './import-client';

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

export interface ImportState {
  run: ImportRun | null;
}

export interface ImportDeps {
  imports: ImportClient;
  /** Called after the first successful import in a session. */
  requestPersistence?: () => Promise<unknown>;
  takeSharedFiles?: () => Promise<File[]>;
}

const emptyRun = (): ImportRun => ({ total: 0, done: 0, added: 0, duplicates: 0, problems: [], active: false });
const FLUSH_MS = 150;

/**
 * Runs imports in the worker and keeps the progress the person sees. Job state lives in memory only:
 * adding the same folder again is safe because every book is deduplicated by its fingerprint.
 * The books themselves reach the screen through the database (see `useLibraryItems`).
 */
export class ImportController {
  readonly store: StoreApi<ImportState>;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private run: ImportRun | null = null;
  private readonly jobTotals = new Map<string, number>();
  private readonly jobDone = new Map<string, number>();
  private persistAsked = false;
  private disposed = false;
  private currentJob: { cancel(): void } | undefined;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly deps: ImportDeps) {
    this.store = createStore<ImportState>(() => ({ run: null }));
  }

  /** Called whenever books were added or an import finished, so the list can refresh at once. */
  onBooksChanged(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

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
      this.dirty = true;
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
    if (this.dirty) {
      this.dirty = false;
      for (const listener of this.listeners) listener();
    }
    this.store.setState({ run: this.run ? { ...this.run, problems: [...this.run.problems] } : null });
  }

  private finishJob(jobId: string): void {
    if (!this.run) return;
    this.jobDone.set(jobId, this.jobTotals.get(jobId) ?? 0);
    const stillRunning = [...this.jobTotals.keys()].some((id) => (this.jobDone.get(id) ?? 0) < (this.jobTotals.get(id) ?? 0) && id !== jobId);
    this.recount();
    if (!stillRunning) this.run.active = false;
    this.dirty = true; // always refresh the list when a batch ends
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
    this.store.setState({ run: null });
  }

  /** Import whatever was shared to the app (Android share sheet). Returns how many files were taken. */
  async importShared(): Promise<number> {
    const take = this.deps.takeSharedFiles;
    if (!take) return 0;
    let files: File[] = [];
    try {
      files = await take();
    } catch {
      this.run ??= emptyRun();
      this.run.problems.push({ name: '', message: 'The shared files could not be read. Please share them again.' });
      this.publishRun();
      return 0;
    }
    void this.importFiles(files.map((file) => ({ file })));
    return files.length;
  }

  private swept = false;

  /** Once per session, before the first import: delete files that belong to no book. */
  sweepOnce(): void {
    if (this.swept) return;
    this.swept = true;
    this.deps.imports.run({ type: 'sweep' }).done.catch(() => undefined);
  }

  dispose(): void {
    this.disposed = true;
    clearTimeout(this.flushTimer);
  }

  private dirty = false;
}
