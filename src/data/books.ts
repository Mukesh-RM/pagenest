import type { BookFormat, BookKind, FileRef } from '@/app/contracts';
import { newId, type PageNestDB } from './db';
import { FilePaths, FileStoreError, type FileStore } from './opfs';
import type {
  BookRecord,
  BookmarkRecord,
  ChapterRecord,
  CollectionBookRecord,
  HighlightRecord,
  ProgressRow,
  RenderRecord,
  SessionRecord,
  TrackRecord,
} from './schema';

/**
 * Everything the library does to a book and its files, in one place (blueprint sections 6 and 13).
 * The importer, the library screens and the detail sheet call this; nobody else writes to the
 * `books` family of stores or to `books/`, `covers/` and `renders/` in OPFS.
 *
 * It takes a database and a file store, so it runs the same in the data worker (heavy file
 * writes stay off the main thread), in the import worker, or in tests with fake storage.
 * Every method takes and returns plain data (Blobs included), so it can sit behind `serveRpc`.
 */

export type BookRepositoryErrorCode =
  /** The input is not a book we can store (empty title, no file, ...). Nothing was written. */
  | 'invalid-input'
  /** The device is out of space. Nothing was kept. */
  | 'storage-full'
  /** A file or database write failed. Nothing was kept. */
  | 'write-failed'
  /** The book does not exist. */
  | 'not-found'
  /** `cleanupOrphans` was called when it is no longer safe (see its documentation). Nothing was deleted. */
  | 'cleanup-not-allowed';

export class BookRepositoryError extends Error {
  readonly code: BookRepositoryErrorCode;
  constructor(code: BookRepositoryErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'BookRepositoryError';
    this.code = code;
  }
}

/** One audio file of an audiobook. */
export interface NewTrack {
  readonly file: Blob;
  /** Original file name, for the stored copy. */
  readonly fileName: string;
  readonly title: string;
  readonly durationSec: number;
  /** Seconds from the start of the book to the start of this track. */
  readonly startOffsetSec: number;
}

/** A chapter, as found in the file. `locator` for text books, `startSec` for audiobooks. */
export type NewChapter = Omit<ChapterRecord, 'bookId'>;

/** What the importer hands over for one book. The repository assigns `id`, `fileRef`, `coverRef`. */
export interface NewBook {
  /** Size plus hash of the first and last megabyte (`computeFingerprint`). */
  readonly fingerprint: string;
  readonly kind: BookKind;
  /** The format detected from the file's content. */
  readonly format: BookFormat;
  readonly title: string;
  readonly author?: string;
  readonly narrator?: string;
  readonly series?: string;
  readonly language?: string;
  readonly durationSec?: number;
  readonly pages?: number;
  /** Epoch ms. Defaults to now. */
  readonly addedAt?: number;
  readonly favorite?: boolean;
  readonly finished?: boolean;
  /** The book file. Required for e-books, PDFs and documents; for an audiobook either this or `tracks`. */
  readonly file?: Blob;
  /** Name of `file`, for the stored copy (for example `Persuasion.epub`). Defaults to `book.<format>`. */
  readonly fileName?: string;
  /** Audiobooks made of several files. */
  readonly tracks?: readonly NewTrack[];
  readonly cover?: Blob;
  readonly chapters?: readonly NewChapter[];
}

/** Adding either stores the book or finds that the same file is already there. */
export type AddBookResult =
  | { readonly status: 'added'; readonly book: BookRecord }
  | { readonly status: 'duplicate'; readonly existing: BookRecord };

/**
 * Metadata a person can edit. A string replaces the value, `null` (or an empty string)
 * clears an optional field. Fields left out are unchanged.
 */
export interface BookPatch {
  readonly title?: string;
  readonly author?: string | null;
  readonly narrator?: string | null;
  readonly series?: string | null;
  readonly language?: string | null;
  readonly favorite?: boolean;
  readonly finished?: boolean;
  /** Epoch ms, or `null` for "never opened". */
  readonly lastOpenedAt?: number | null;
}

/** Proof that books were removed but can still come back. Pass `token` to `restore` or `purge`. */
export interface RemoveReceipt {
  readonly token: string;
  /** Ids that were removed (ids that did not exist are left out). */
  readonly bookIds: string[];
}

export interface RestoreResult {
  /** Books that are back. */
  readonly restored: string[];
  /** Books that could not come back because the same file was added again in the meantime. Their files were deleted. */
  readonly skipped: string[];
}

/** Files left behind by a crash or an interrupted import, now deleted. */
export interface OrphanReport {
  readonly removedBookIds: string[];
  readonly freedBytes: number;
}

interface Snapshot {
  readonly books: BookRecord[];
  readonly tracks: TrackRecord[];
  readonly chapters: ChapterRecord[];
  readonly progress: ProgressRow[];
  readonly bookmarks: BookmarkRecord[];
  readonly highlights: HighlightRecord[];
  readonly sessions: SessionRecord[];
  readonly links: CollectionBookRecord[];
  readonly renders: RenderRecord[];
}

const OPTIONAL_TEXT = ['author', 'narrator', 'series', 'language'] as const;

function isQuotaError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'QuotaExceededError' || /quota/i.test(error.name));
}

/** A name safe to use as one path segment. */
export function safeFileName(name: string | undefined, fallback: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = (name ?? '').replace(/[\\/\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim().slice(0, 120);
  return cleaned === '' ? fallback : cleaned;
}

function cleanText(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v === undefined || v === '' ? undefined : v;
}

/**
 * The part of the browser's Web Locks API this file uses (`navigator.locks`). Every `add` holds the
 * lock shared and `cleanupOrphans` takes it exclusive, so a clean-up can never overlap an import,
 * even one running in another worker or tab. Without Web Locks the guard covers this instance only.
 */
export interface WriteLocks {
  request<T>(
    name: string,
    options: { mode: 'shared' | 'exclusive'; ifAvailable?: boolean },
    callback: (lock: unknown) => Promise<T>,
  ): Promise<T>;
}

const WRITE_LOCK = 'pagenest:book-files';

function browserLocks(): WriteLocks | undefined {
  return (globalThis as { navigator?: { locks?: WriteLocks } }).navigator?.locks;
}

export class BookRepository {
  private readonly trashed = new Map<string, Snapshot>();
  /** An `add` got past validation on this instance: orphan clean-up is no longer safe. */
  private addsStarted = false;
  /** Orphan clean-up finished on this instance. */
  private cleanupDone = false;
  /** The orphan clean-up in progress, if any. */
  private cleanup: Promise<void> | undefined;
  /** Books whose files are being written right now; `cleanupOrphans` must not touch them. */
  private readonly inflight = new Set<string>();

  constructor(
    private readonly db: PageNestDB,
    private readonly files: FileStore | Promise<FileStore>,
    private readonly now: () => number = Date.now,
    private readonly locks: WriteLocks | undefined = browserLocks(),
  ) {}

  private store(): Promise<FileStore> {
    return Promise.resolve(this.files);
  }

  // ---------------------------------------------------------------- reading

  async get(id: string): Promise<BookRecord | undefined> {
    return this.db.books.get(id);
  }

  /** The books with these ids, in the same order; unknown ids are left out. */
  async getMany(ids: readonly string[]): Promise<BookRecord[]> {
    const found = await this.db.books.bulkGet([...ids]);
    return found.filter((b): b is BookRecord => b !== undefined);
  }

  /** The book that has this fingerprint, if any. Ask this before copying a file's bytes. */
  async findByFingerprint(fingerprint: string): Promise<BookRecord | undefined> {
    return this.db.books.where('fingerprint').equals(fingerprint).first();
  }

  async count(): Promise<number> {
    return this.db.books.count();
  }

  async getTracks(bookId: string): Promise<TrackRecord[]> {
    return this.db.tracks.where('bookId').equals(bookId).sortBy('index');
  }

  async getChapters(bookId: string): Promise<ChapterRecord[]> {
    return this.db.chapters.where('bookId').equals(bookId).sortBy('index');
  }

  // ----------------------------------------------------------------- adding

  /**
   * Store a book: its file(s), cover, chapters and library record, all or nothing.
   * If the fingerprint is already in the library, nothing is written and the existing book is returned.
   * @throws BookRepositoryError `invalid-input`, `storage-full` or `write-failed`; in each case no files are left behind.
   */
  async add(input: NewBook): Promise<AddBookResult> {
    const title = cleanText(input.title);
    if (!title) throw new BookRepositoryError('invalid-input', 'A book needs a title.');
    if (input.fingerprint.trim() === '') throw new BookRepositoryError('invalid-input', 'A book needs a fingerprint.');
    const hasTracks = (input.tracks?.length ?? 0) > 0;
    if (input.kind === 'audio' ? !input.file && !hasTracks : !input.file) {
      throw new BookRepositoryError('invalid-input', 'A book needs its file.');
    }
    if (input.kind !== 'audio' && hasTracks) throw new BookRepositoryError('invalid-input', 'Only audiobooks have tracks.');

    this.addsStarted = true;
    // An orphan clean-up that is running finishes first, so it cannot take this book's new files.
    await this.cleanup?.then(noop, noop);
    return this.locks ? this.locks.request(WRITE_LOCK, { mode: 'shared' }, () => this.addValidated(input, title)) : this.addValidated(input, title);
  }

  private async addValidated(input: NewBook, title: string): Promise<AddBookResult> {
    const existing = await this.findByFingerprint(input.fingerprint);
    if (existing) return { status: 'duplicate', existing };

    const id = newId();
    const files = await this.store();
    this.inflight.add(id);
    try {
      let fileRef: FileRef | undefined;
      if (input.file) {
        fileRef = FilePaths.book(id, safeFileName(input.fileName, `book.${input.format}`));
        await files.write(fileRef, input.file);
      }
      const tracks: TrackRecord[] = [];
      for (const [index, t] of (input.tracks ?? []).entries()) {
        const ref = FilePaths.track(id, index, safeFileName(t.fileName, `track-${index}`));
        await files.write(ref, t.file);
        tracks.push({ bookId: id, index, fileRef: ref, title: t.title, durationSec: t.durationSec, startOffsetSec: t.startOffsetSec });
      }
      let coverRef: FileRef | undefined;
      if (input.cover) {
        coverRef = FilePaths.cover(id);
        await files.write(coverRef, input.cover);
      }

      const book: BookRecord = {
        id,
        fingerprint: input.fingerprint,
        kind: input.kind,
        format: input.format,
        title,
        ...(cleanText(input.author) ? { author: cleanText(input.author) as string } : {}),
        ...(cleanText(input.narrator) ? { narrator: cleanText(input.narrator) as string } : {}),
        ...(cleanText(input.series) ? { series: cleanText(input.series) as string } : {}),
        ...(cleanText(input.language) ? { language: cleanText(input.language) as string } : {}),
        ...(coverRef ? { coverRef } : {}),
        ...(fileRef ? { fileRef } : {}),
        ...(input.durationSec !== undefined ? { durationSec: input.durationSec } : {}),
        ...(input.pages !== undefined ? { pages: input.pages } : {}),
        addedAt: input.addedAt ?? this.now(),
        favorite: input.favorite ?? false,
        finished: input.finished ?? false,
      };
      const chapters: ChapterRecord[] = (input.chapters ?? []).map((c) => ({ ...c, bookId: id }));

      await this.db.transaction('rw', this.db.books, this.db.tracks, this.db.chapters, async () => {
        await this.db.books.add(book);
        if (tracks.length > 0) await this.db.tracks.bulkAdd(tracks);
        if (chapters.length > 0) await this.db.chapters.bulkAdd(chapters);
      });
      return { status: 'added', book };
    } catch (error) {
      await this.removeFilesOf(id);
      if (isConstraintError(error)) {
        // Someone added the same file between our check and our write.
        const winner = await this.findByFingerprint(input.fingerprint);
        if (winner) return { status: 'duplicate', existing: winner };
      }
      if (error instanceof BookRepositoryError) throw error;
      throw new BookRepositoryError(
        isQuotaError(error) ? 'storage-full' : 'write-failed',
        isQuotaError(error) ? 'There is not enough space on this device to add the book.' : 'The book could not be saved.',
        { cause: error },
      );
    } finally {
      this.inflight.delete(id);
    }
  }

  // ---------------------------------------------------------------- editing

  /**
   * Edit metadata and flags. Returns the updated book.
   * @throws BookRepositoryError `not-found`, or `invalid-input` for an empty title.
   */
  async update(id: string, patch: BookPatch): Promise<BookRecord> {
    if (patch.title !== undefined && cleanText(patch.title) === undefined) {
      throw new BookRepositoryError('invalid-input', 'A book needs a title.');
    }
    return this.db.transaction('rw', this.db.books, async () => {
      const book = await this.db.books.get(id);
      if (!book) throw new BookRepositoryError('not-found', 'That book is not in the library.');
      const next: BookRecord = { ...book };
      if (patch.title !== undefined) next.title = cleanText(patch.title) as string;
      for (const key of OPTIONAL_TEXT) {
        const value = patch[key];
        if (value === undefined) continue;
        const text = value === null ? undefined : cleanText(value);
        if (text === undefined) delete next[key];
        else next[key] = text;
      }
      if (patch.favorite !== undefined) next.favorite = patch.favorite;
      if (patch.finished !== undefined) next.finished = patch.finished;
      if (patch.lastOpenedAt !== undefined) {
        if (patch.lastOpenedAt === null) delete next.lastOpenedAt;
        else next.lastOpenedAt = patch.lastOpenedAt;
      }
      await this.db.books.put(next);
      return next;
    });
  }

  /** Remember that the book was opened now. Cheap; call when a reader or player opens. */
  async markOpened(id: string): Promise<BookRecord> {
    return this.update(id, { lastOpenedAt: this.now() });
  }

  /** Replace the chapter list (for example after the reader found better ones). */
  async setChapters(bookId: string, chapters: readonly NewChapter[]): Promise<void> {
    await this.db.transaction('rw', this.db.books, this.db.chapters, async () => {
      if (!(await this.db.books.get(bookId))) throw new BookRepositoryError('not-found', 'That book is not in the library.');
      await this.db.chapters.where('bookId').equals(bookId).delete();
      const rows: ChapterRecord[] = chapters.map((c) => ({ ...c, bookId }));
      if (rows.length > 0) await this.db.chapters.bulkAdd(rows);
    });
  }

  // ----------------------------------------------------------------- covers

  /**
   * Store or replace the cover image (any image type; make it a thumbnail-sized JPEG or WebP in the import worker).
   * @throws BookRepositoryError `not-found`, `storage-full` or `write-failed`.
   */
  async setCover(bookId: string, image: Blob): Promise<FileRef> {
    if (!(await this.db.books.get(bookId))) throw new BookRepositoryError('not-found', 'That book is not in the library.');
    const ref = FilePaths.cover(bookId);
    try {
      await (await this.store()).write(ref, image);
    } catch (error) {
      throw new BookRepositoryError(
        isQuotaError(error) ? 'storage-full' : 'write-failed',
        isQuotaError(error) ? 'There is not enough space on this device to save the cover.' : 'The cover could not be saved.',
        { cause: error },
      );
    }
    await this.db.books.update(bookId, { coverRef: ref });
    return ref;
  }

  /** Delete the cover; the library then shows a generated title card. */
  async removeCover(bookId: string): Promise<void> {
    const book = await this.db.books.get(bookId);
    if (!book?.coverRef) return;
    await (await this.store()).remove(book.coverRef);
    await this.db.books.where('id').equals(bookId).modify((b) => {
      delete b.coverRef;
    });
  }

  /** The cover image, or `undefined` when the book has none (or its file is missing). */
  async getCover(bookId: string): Promise<Blob | undefined> {
    const book = await this.db.books.get(bookId);
    if (!book?.coverRef) return undefined;
    try {
      return await (await this.store()).open(book.coverRef);
    } catch (error) {
      if (error instanceof FileStoreError && error.code === 'not-found') return undefined;
      throw error;
    }
  }

  // --------------------------------------------------------------- removing

  /**
   * Remove books from the library, with a way back. The database rows (progress, bookmarks,
   * highlights, sessions, shelf links, renders, chapters, tracks) go at once; the files stay until
   * {@link purge}. Show "Deleted. Undo" and call `restore(token)` on Undo or `purge(token)` when it times out.
   */
  async trash(ids: readonly string[]): Promise<RemoveReceipt> {
    const unique = [...new Set(ids)];
    const snapshot = await this.db.transaction(
      'rw',
      [this.db.books, this.db.tracks, this.db.chapters, this.db.progress, this.db.bookmarks, this.db.highlights, this.db.sessions, this.db.collectionBooks, this.db.renders],
      async (): Promise<Snapshot> => {
        const books = (await this.db.books.bulkGet(unique)).filter((b): b is BookRecord => b !== undefined);
        const found = books.map((b) => b.id);
        const snap: Snapshot = {
          books,
          tracks: await this.db.tracks.where('bookId').anyOf(found).toArray(),
          chapters: await this.db.chapters.where('bookId').anyOf(found).toArray(),
          progress: await this.db.progress.where('bookId').anyOf(found).toArray(),
          bookmarks: await this.db.bookmarks.where('bookId').anyOf(found).toArray(),
          highlights: await this.db.highlights.where('bookId').anyOf(found).toArray(),
          sessions: await this.db.sessions.where('bookId').anyOf(found).toArray(),
          links: await this.db.collectionBooks.where('bookId').anyOf(found).toArray(),
          renders: await this.db.renders.where('bookId').anyOf(found).toArray(),
        };
        await this.db.books.bulkDelete(found);
        await this.db.tracks.where('bookId').anyOf(found).delete();
        await this.db.chapters.where('bookId').anyOf(found).delete();
        await this.db.progress.where('bookId').anyOf(found).delete();
        await this.db.bookmarks.where('bookId').anyOf(found).delete();
        await this.db.highlights.where('bookId').anyOf(found).delete();
        await this.db.sessions.where('bookId').anyOf(found).delete();
        await this.db.collectionBooks.where('bookId').anyOf(found).delete();
        await this.db.renders.where('bookId').anyOf(found).delete();
        return snap;
      },
    );
    const token = newId();
    this.trashed.set(token, snapshot);
    return { token, bookIds: snapshot.books.map((b) => b.id) };
  }

  /** Undo a {@link trash}. Unknown or already finished tokens restore nothing. */
  async restore(token: string): Promise<RestoreResult> {
    const snap = this.trashed.get(token);
    if (!snap) return { restored: [], skipped: [] };
    this.trashed.delete(token);
    const restored: string[] = [];
    const skipped: string[] = [];
    await this.db.transaction(
      'rw',
      [this.db.books, this.db.tracks, this.db.chapters, this.db.progress, this.db.bookmarks, this.db.highlights, this.db.sessions, this.db.collectionBooks, this.db.renders, this.db.collections],
      async () => {
        const shelves = new Set(await this.db.collections.toCollection().primaryKeys());
        for (const book of snap.books) {
          const clash = await this.db.books.where('fingerprint').equals(book.fingerprint).first();
          if (clash) {
            skipped.push(book.id);
            continue;
          }
          await this.db.books.add(book);
          restored.push(book.id);
        }
        const keep = new Set(restored);
        await this.db.tracks.bulkPut(snap.tracks.filter((r) => keep.has(r.bookId)));
        await this.db.chapters.bulkPut(snap.chapters.filter((r) => keep.has(r.bookId)));
        await this.db.progress.bulkPut(snap.progress.filter((r) => keep.has(r.bookId)));
        await this.db.bookmarks.bulkPut(snap.bookmarks.filter((r) => keep.has(r.bookId)));
        await this.db.highlights.bulkPut(snap.highlights.filter((r) => keep.has(r.bookId)));
        await this.db.sessions.bulkPut(snap.sessions.filter((r) => keep.has(r.bookId)));
        await this.db.renders.bulkPut(snap.renders.filter((r) => keep.has(r.bookId)));
        // A shelf deleted in the meantime cannot take its books back.
        await this.db.collectionBooks.bulkPut(snap.links.filter((r) => keep.has(r.bookId) && shelves.has(r.collectionId)));
      },
    );
    await Promise.all(skipped.map((id) => this.removeFilesOf(id)));
    return { restored, skipped };
  }

  /** Make a {@link trash} final: delete the files. Returns the bytes freed. */
  async purge(token: string): Promise<number> {
    const snap = this.trashed.get(token);
    if (!snap) return 0;
    this.trashed.delete(token);
    let freed = 0;
    for (const book of snap.books) freed += await this.removeFilesOf(book.id);
    return freed;
  }

  /** Make every pending {@link trash} final (for example when the app is closing). */
  async purgeAll(): Promise<number> {
    let freed = 0;
    for (const token of [...this.trashed.keys()]) freed += await this.purge(token);
    return freed;
  }

  /** Remove books and their files for good, with no undo. */
  async remove(ids: readonly string[]): Promise<RemoveReceipt & { freedBytes: number }> {
    const receipt = await this.trash(ids);
    return { ...receipt, freedBytes: await this.purge(receipt.token) };
  }

  /**
   * Delete files of books that no longer exist: leftovers from a crash during an import or
   * before an Undo timed out.
   *
   * **Call it exactly once, at startup, before any import begins.** It cannot tell a half-written
   * import from a leftover, so it refuses instead of guessing:
   * - after this repository has started adding a book,
   * - a second time (also while the first call is still running),
   * - while an `add` is running in another worker or tab (browsers with Web Locks).
   *
   * Books waiting in this repository's trash are never touched.
   * @throws BookRepositoryError `cleanup-not-allowed` (nothing is deleted). Catch it and carry on:
   *   it only means the clean-up is not needed or not safe right now; the leftovers go at the next start.
   */
  async cleanupOrphans(): Promise<OrphanReport> {
    if (this.cleanupDone || this.cleanup) {
      throw new BookRepositoryError('cleanup-not-allowed', 'Orphan clean-up already ran. It runs once, at startup.');
    }
    if (this.addsStarted || this.inflight.size > 0) {
      throw new BookRepositoryError('cleanup-not-allowed', 'Orphan clean-up must run before any book is added, because a book being added looks like an orphan.');
    }
    const run = (): Promise<OrphanReport> => this.removeOrphans();
    const locked = this.locks
      ? this.locks.request(WRITE_LOCK, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
          if (!lock) throw new BookRepositoryError('cleanup-not-allowed', 'A book is being added right now, so orphan clean-up was skipped.');
          return run();
        })
      : run();
    const promise = locked.then((report) => {
      this.cleanupDone = true;
      return report;
    });
    // Never rejects: it only marks "running" and lets `add` wait for the end.
    this.cleanup = promise.then(noop, noop).then(() => {
      this.cleanup = undefined;
    });
    return promise;
  }

  private async removeOrphans(): Promise<OrphanReport> {
    const files = await this.store();
    const known = new Set(await this.db.books.toCollection().primaryKeys());
    for (const snap of this.trashed.values()) for (const b of snap.books) known.add(b.id);
    for (const id of this.inflight) known.add(id);

    const stale = new Map<string, FileRef[]>();
    const note = (id: string, path: FileRef): void => {
      if (!known.has(id)) stale.set(id, [...(stale.get(id) ?? []), path]);
    };
    for (const e of await files.list('books')) if (e.kind === 'directory') note(e.name, `books/${e.name}`);
    for (const e of await files.list('covers')) if (e.kind === 'file') note(e.name.replace(/\.img$/, ''), `covers/${e.name}`);
    for (const e of await files.list('renders')) if (e.kind === 'directory') note(e.name, `renders/${e.name}`);

    let freedBytes = 0;
    for (const paths of stale.values()) {
      for (const path of paths) {
        freedBytes += await files.usage(path);
        await files.remove(path);
      }
    }
    return { removedBookIds: [...stale.keys()], freedBytes };
  }

  /** Delete one book's files (book folder, cover, rendered audio); returns bytes freed. */
  private async removeFilesOf(id: string): Promise<number> {
    const files = await this.store();
    let freed = 0;
    for (const path of [`books/${id}`, FilePaths.cover(id), `renders/${id}`]) {
      try {
        freed += await files.usage(path);
        await files.remove(path);
      } catch {
        // A file that cannot be deleted is picked up by cleanupOrphans next time.
      }
    }
    return freed;
  }
}

function noop(): void {}

function isConstraintError(error: unknown): boolean {
  return error instanceof Error && error.name === 'ConstraintError';
}
