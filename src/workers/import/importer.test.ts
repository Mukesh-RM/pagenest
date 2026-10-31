// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PageNestDB } from '@/data/db';
import { BookRepository } from '@/data/books';
import { CollectionRepository } from '@/data/collections';
import { MemoryFileStore } from '@/data/opfs';
import { createImportService } from './service';
import type { ImportItem, ItemOutcome, RestoreSummary, WorkerEvent } from './protocol';
import { titleFromFileName } from './names';
import { parseAudio } from './parsers/audio';
import {
  concat, jpegStub, makeCbz, makeDocx, makeEpub, makeFb2, makeFlac, makeHtml, makeMobi, makeMp3, makeMp4Audio, makeOgg, makePdf, makePdfCompressed, makePng,
  makeText, makeUtf16Text, makeWav, makeZip,
} from './testing/fixtures';
import { createBackup, listBackupFiles, restoreBackup, storageBreakdown, clearCaches } from './backup';
import { readZipEntries } from './zip';

let db: PageNestDB;
let files: MemoryFileStore;
let counter = 0;

beforeEach(() => {
  counter += 1;
  db = new PageNestDB(`importer-test-${counter}-${Math.random()}`);
  files = new MemoryFileStore();
});
afterEach(async () => {
  db.close();
  await db.delete();
});

const depsFor = (d: PageNestDB, f: MemoryFileStore) => ({ db: d, files: f, books: new BookRepository(d, f), collections: new CollectionRepository(d) });
const serviceFor = (d: PageNestDB, f: MemoryFileStore) => createImportService({ ...depsFor(d, f), parseAudio, makeThumbnail: async () => undefined });
const service = () => serviceFor(db, files);
const item = (bytes: Uint8Array, name: string, relPath?: string, type = ''): ImportItem => ({ file: new File([bytes as BlobPart], name, { type }), ...(relPath ? { relPath } : {}) });

async function run(items: ImportItem[]): Promise<{ outcomes: ItemOutcome[]; events: WorkerEvent[]; summary: unknown }> {
  const events: WorkerEvent[] = [];
  await service().handle({ type: 'import', jobId: 'j', items }, (e) => events.push(e));
  const outcomes = events.flatMap((e) => (e.type === 'outcome' ? [e.outcome] : []));
  const done = events.find((e) => e.type === 'done');
  return { outcomes, events, summary: done?.type === 'done' ? done.result : undefined };
}

const png = await makePng(10, 15);

describe('importing files whose names lie', () => {
  it('imports every format by content, whatever the file is called', async () => {
    const mixed: [Uint8Array, string, string][] = [
      [await makeEpub({ title: 'Epub Book', author: 'E. Author', cover: png }), 'book.epub__1_', 'epub'],
      [makePdf({ title: 'Pdf Book', pages: 9 }), 'no-extension', 'pdf'],
      [await makePdfCompressed({ title: 'Compressed Pdf' }), 'looks-like.txt', 'pdf'],
      [await makeDocx({ title: 'Doc Title' }), 'file.pdf', 'docx'],
      [await makeCbz({ pages: 4 }), 'COMIC.ZIP', 'cbz'],
      [makeMobi({ title: 'Mobi Book', cover: png }), 'kindle.epub', 'mobi'],
      [makeMobi({ title: 'KF8', version: 8 }), 'kf8', 'azw3'],
      [makeFb2({ title: 'Fb2 Book', cover: png }), 'story.xml', 'fb2'],
      [makeText('Plain words only.'), 'notes.epub', 'txt'],
      [makeUtf16Text(), 'utf16', 'txt'],
      [makeHtml('Web Page'), 'page.dat', 'html'],
      [makeMp3({ title: 'Ch 1', album: 'MP3 Book', artist: 'Reader', frames: 100 }), 'audio.pdf', 'mp3'],
      [makeMp4Audio({ brand: 'M4B ', album: 'M4B Book', chapters: [['A', 0], ['B', 4]] }), 'x', 'm4b'],
      [makeMp4Audio({ brand: 'M4A ', album: 'M4A Book' }), 'weird name (2)', 'm4a'],
      [makeFlac(), 'sound.mp3', 'flac'],
      [makeWav(), 'sound.flac', 'wav'],
      [makeOgg('opus'), 'voice.ogg', 'opus'],
      [makeOgg('vorbis'), 'voice2.opus', 'ogg'],
    ];
    const { outcomes, summary } = await run(mixed.map(([bytes, name], i) => item(bytes, name, undefined, i % 2 ? 'application/octet-stream' : '')));
    expect(summary).toEqual({ added: mixed.length, duplicates: 0, unsupported: 0, skipped: 0 });
    const byName = new Map(outcomes.flatMap((o) => (o.status === 'added' ? [[o.name, o.book] as const] : [])));
    for (const [, name, format] of mixed) expect(byName.get(name)?.format, name).toBe(format);

    const epub = byName.get('book.epub__1_');
    expect(epub).toMatchObject({ title: 'Epub Book', author: 'E. Author', kind: 'ebook', fileRef: expect.stringMatching(/\/book\.epub$/), coverRef: expect.stringMatching(/^covers\//) });
    expect(await files.exists(epub?.fileRef as string)).toBe(true);
    expect(await files.exists(epub?.coverRef as string)).toBe(true);
    expect(byName.get('no-extension')).toMatchObject({ title: 'Pdf Book', pages: 9, kind: 'pdf' });
    expect(byName.get('page.dat')?.title).toBe('Web Page');
    expect(byName.get('notes.epub')?.title).toBe('notes'); // no title inside: made from the name
    expect(byName.get('audio.pdf')).toMatchObject({ title: 'MP3 Book', author: 'Reader', kind: 'audio' });
    // Audio gets one track, and chapters when the file has them.
    const m4b = byName.get('x');
    expect(await db.tracks.where('bookId').equals(m4b?.id as string).count()).toBe(1);
    expect((await db.chapters.where('bookId').equals(m4b?.id as string).sortBy('index')).map((c) => [c.title, c.startSec])).toEqual([['A', 0], ['B', 4]]);
    expect(await db.books.count()).toBe(mixed.length);
    // The stored file name comes from the detected format, never from the original name.
    for (const b of byName.values()) if (b.fileRef) expect(b.fileRef).toMatch(new RegExp(`/book\\.${b.format}$`));
  });

  it('says plainly what cannot be opened, and keeps going with the rest', async () => {
    const drmEpub = await makeEpub({ drm: true });
    const { outcomes, summary } = await run([
      item(await makeEpub({ title: 'Good' }), 'good'),
      item(drmEpub, 'protected.epub'),
      item(png, 'cover.jpg'),
      item(new Uint8Array(0), 'empty.pdf'),
      item(await makeZip([{ name: 'a.txt', data: 'x' }]), 'archive.epub'),
      item(makeMp4Audio({ brand: 'M4P ' }), 'itunes.m4a'),
      item(Uint8Array.from({ length: 4000 }, (_, i) => (i * 31) % 251), 'random.bin'),
      item(jpegStub(), 'photo.pdf'),
    ]);
    expect(summary).toEqual({ added: 1, duplicates: 0, unsupported: 7, skipped: 0 });
    const msg = (name: string): string => (outcomes.find((o) => o.name === name && o.status === 'unsupported') as { message: string }).message;
    expect(msg('protected.epub')).toBe('This file is protected by DRM, so InkQuiet cannot open it.');
    expect(msg('itunes.m4a')).toBe('This file is protected by DRM, so InkQuiet cannot open it.');
    expect(msg('empty.pdf')).toMatch(/empty/);
    expect(msg('archive.epub')).toMatch(/ZIP archive/);
    expect(msg('random.bin')).toMatch(/cannot open this kind of file/);
    for (const o of outcomes) if (o.status === 'unsupported') expect(o.message).not.toMatch(/Error|undefined|\bat \w+\.|code/);
    // Nothing from refused files is left behind.
    expect(await db.books.count()).toBe(1);
    expect((await files.list('books')).length).toBe(1);
  });

  it('refuses a duplicate even under another name, in the same batch and in a later one', async () => {
    const epub = await makeEpub({ title: 'Same Book', salt: 'x' });
    const first = await run([item(epub, 'one.epub'), item(epub, 'two'), item(epub, 'three.pdf')]);
    expect(first.summary).toEqual({ added: 1, duplicates: 2, unsupported: 0, skipped: 0 });
    const second = await run([item(epub, 'again.bin')]);
    expect(second.outcomes[0]).toMatchObject({ status: 'duplicate', title: 'Same Book' });
    expect(await db.books.count()).toBe(1);
    expect((await files.list('books')).length).toBe(1);
  });

  it('keeps imported books in the order they were chosen', async () => {
    const list = await Promise.all(Array.from({ length: 12 }, async (_, i) => item(await makeEpub({ title: `T${i}`, salt: String(i) }), `f${i}`)));
    await run(list);
    const rows = await db.books.orderBy('addedAt').toArray();
    expect(new Set(rows.map((r) => r.addedAt)).size).toBe(12);
  });

  it('can be cancelled between files', async () => {
    const list = await Promise.all(Array.from({ length: 30 }, async (_, i) => item(await makeEpub({ title: `T${i}`, salt: String(i) }), `f${i}`)));
    const svc = service();
    const events: WorkerEvent[] = [];
    await svc.handle({ type: 'import', jobId: 'c', items: list }, (e) => {
      events.push(e);
      if (e.type === 'outcome' && e.done === 5) void svc.handle({ type: 'cancel', jobId: 'c' }, () => undefined);
    });
    const added = await db.books.count();
    expect(added).toBeGreaterThanOrEqual(5);
    expect(added).toBeLessThan(30);
  });

  it('reports a full device in plain words and cleans up', async () => {
    const failing = new MemoryFileStore();
    const originalWrite = failing.write.bind(failing);
    failing.write = async (path, data) => {
      if (path.startsWith('books/')) throw Object.assign(new Error('x'), { name: 'QuotaExceededError' });
      return originalWrite(path, data);
    };
    const events: WorkerEvent[] = [];
    await serviceFor(db, failing).handle({ type: 'import', jobId: 'q', items: [item(await makeEpub(), 'a')] }, (e) => events.push(e));
    const outcome = events.find((e) => e.type === 'outcome');
    expect(outcome?.type === 'outcome' && outcome.outcome).toMatchObject({ status: 'unsupported', reason: 'storage-full' });
    expect(await db.books.count()).toBe(0);
  });
});

describe('a folder of audio files', () => {
  it('becomes one audiobook with tracks in natural order, a cover from the folder and no errors for the picture', async () => {
    const tracks = [10, 2, 1].map((n) => item(makeMp3({ title: `Part ${n}`, album: 'Folder Book', artist: 'Someone', frames: 200 + n }), `Track ${n}.dat`, `Folder Book/Track ${n}.dat`));
    const { outcomes, summary } = await run([...tracks, item(png, 'cover.jpg', 'Folder Book/cover.jpg'), item(png, 'back.jpg', 'Folder Book/back.jpg')]);
    expect(summary).toEqual({ added: 1, duplicates: 0, unsupported: 0, skipped: 2 });
    const book = outcomes.find((o) => o.status === 'added');
    expect(book?.status === 'added' && book.book).toMatchObject({ title: 'Folder Book', author: 'Someone', kind: 'audio', coverRef: expect.any(String) });
    const id = book?.status === 'added' ? book.book.id : '';
    const rows = await db.tracks.where('bookId').equals(id).sortBy('index');
    expect(rows.map((t) => t.title)).toEqual(['Part 1', 'Part 2', 'Part 10']);
    expect(rows[1]?.startOffsetSec).toBeCloseTo(rows[0]?.durationSec ?? 0, 3);
    expect(rows.every((t) => t.fileRef.endsWith('.mp3'))).toBe(true);
    const chapters = await db.chapters.where('bookId').equals(id).sortBy('index');
    expect(chapters[2]?.locator).toEqual({ kind: 'audio', trackIndex: 2, positionSec: 0 });
    // Adding the same folder again changes nothing.
    const again = await run([...tracks]);
    expect(again.summary).toEqual({ added: 0, duplicates: 1, unsupported: 0, skipped: 0 });
  });

  it('keeps a lone audio file in a folder as a single book', async () => {
    const { summary } = await run([item(makeMp3({ title: 'Only', frames: 30 }), 'only.mp3', 'Music/only.mp3')]);
    expect(summary).toEqual({ added: 1, duplicates: 0, unsupported: 0, skipped: 0 });
  });
});

describe('titles from file names', () => {
  it.each([
    ['book.epub__1_', 'book'],
    ['My_Book.final.epub__1_', 'My Book.final'],
    ['Moby-Dick (2).pdf', 'Moby-Dick'],
    ['noextension', 'noextension'],
    ['Dr. Jekyll and Mr. Hyde', 'Dr. Jekyll and Mr. Hyde'],
    ['report - Copy.docx', 'report'],
    ['..epub', 'Untitled'],
    ['Folder/inner/Title.m4b', 'Title'],
  ])('%s becomes %s', (name, title) => {
    expect(titleFromFileName(name)).toBe(title);
  });
});

describe('backup and restore', () => {
  async function fill(): Promise<void> {
    await run([
      item(await makeEpub({ title: 'Backed Up', author: 'B', cover: png }), 'a'),
      item(makePdf({ title: 'Second' }), 'b'),
      item(makeMp3({ title: 'T', album: 'Audio', frames: 50 }), 'c'),
    ]);
    const first = (await db.books.toArray()).find((b) => b.title === 'Backed Up');
    await db.progress.put({ bookId: first?.id as string, mode: 'read', locator: { kind: 'reflow', section: 2, textOffset: 40 }, percent: 42, updatedAt: 1000 });
    await db.bookmarks.put({ id: 'bm1', bookId: first?.id as string, locator: { kind: 'reflow', section: 1, textOffset: 0 }, label: 'Here', createdAt: 5 });
    await db.collections.put({ id: 'col1', name: 'Favorites', order: 0 });
    await db.collectionBooks.put({ collectionId: 'col1', bookId: first?.id as string, order: 0 });
    await db.settings.put({ key: 'appTheme', value: 'dark' });
    await db.voices.put({ id: 'v1', name: 'Mine', engine: 'piper' as never, language: 'en', isOwnVoice: true, createdAt: 9 });
    await files.write('voices/v1/model.bin', new Uint8Array([1, 2, 3]));
    await files.write('renders/x/1.opus', new Uint8Array(10)); // a cache: not saved
  }

  it('saves everything in one zip and restores it into an empty library', async () => {
    await fill();
    const zip = await createBackup(db, files, undefined, () => new Date(2026, 9, 24));
    const names = (await readZipEntries(zip)).map((e) => e.name);
    expect(names).toContain('pagenest-backup.json');
    expect(names).toContain('data/books.json');
    expect(names.filter((n) => n.startsWith('files/renders'))).toEqual([]);
    expect(names.some((n) => n.startsWith('files/voices/v1'))).toBe(true);

    const db2 = new PageNestDB(`restore-${counter}-${Math.random()}`);
    const files2 = new MemoryFileStore();
    try {
      const summary = await restoreBackup(zip, depsFor(db2, files2));
      expect(summary).toMatchObject({ booksAdded: 3, booksAlreadyThere: 0 });
      expect(await db2.books.count()).toBe(3);
      expect(await db2.progress.count()).toBe(1);
      const book0 = (await db2.books.toArray()).find((b) => b.title === 'Backed Up');
      expect((await db2.bookmarks.get('bm1'))?.bookId).toBe(book0?.id);
      expect((await db2.collections.toArray()).map((c) => c.name)).toEqual(['Favorites']);
      expect((await db2.collectionBooks.toArray()).map((l) => l.bookId)).toEqual([book0?.id]);
      expect((await db2.settings.get('appTheme'))?.value).toBe('dark');
      expect((await db2.voices.get('v1'))?.name).toBe('Mine');
      expect((await listBackupFiles(files2)).length).toBe((await listBackupFiles(files)).length);
      const book = (await db2.books.toArray()).find((b) => b.title === 'Backed Up');
      const before = (await db.books.toArray()).find((b) => b.title === 'Backed Up');
      expect(book?.id).not.toBe(before?.id); // restored through BookRepository.add: new id, same book
      expect(book?.coverRef).toBeDefined();
      const original = await files.open(before?.fileRef as string);
      const copy = await files2.open(book?.fileRef as string);
      expect(new Uint8Array(await copy.arrayBuffer())).toEqual(new Uint8Array(await original.arrayBuffer()));
    } finally {
      db2.close();
      await db2.delete();
    }
  });

  it('merges into a library that already has some of the books', async () => {
    await fill();
    const zip = await createBackup(db, files);
    // Same books under new ids in a second library, with newer progress there.
    const db2 = new PageNestDB(`merge-${counter}-${Math.random()}`);
    const files2 = new MemoryFileStore();
    try {
      await serviceFor(db2, files2).handle(
        { type: 'import', jobId: 'm', items: [item(await makeEpub({ title: 'Backed Up', author: 'B', cover: png }), 'zzz')] },
        () => undefined,
      );
      const existing = (await db2.books.toArray())[0];
      await db2.progress.put({ bookId: existing?.id as string, mode: 'read', locator: { kind: 'reflow', section: 9, textOffset: 1 }, percent: 90, updatedAt: 5000 });
      const summary = await restoreBackup(zip, depsFor(db2, files2));
      expect(summary).toMatchObject({ booksAdded: 2, booksAlreadyThere: 1 });
      expect(await db2.books.count()).toBe(3);
      expect((await db2.progress.get([existing?.id as string, 'read']))?.percent).toBe(90); // newer progress kept
      expect((await db2.collectionBooks.toArray())[0]?.bookId).toBe(existing?.id); // shelf link follows the kept book
      expect(await db2.bookmarks.get('bm1')).toBeUndefined(); // the bookmark belongs to the copy that was not restored
    } finally {
      db2.close();
      await db2.delete();
    }
  });

  it('refuses files that are not backups, or are damaged, in plain words', async () => {
    const fresh = new PageNestDB(`damaged-${counter}-${Math.random()}`);
    const msg = async (blob: Blob): Promise<string> => {
      const events: WorkerEvent[] = [];
      await serviceFor(fresh, new MemoryFileStore()).handle({ type: 'restore', jobId: 'r', file: blob }, (e) => events.push(e));
      const failed = events.find((e) => e.type === 'failed');
      return failed?.type === 'failed' ? failed.message : 'no failure';
    };
    expect(await msg(new Blob([concat([1, 2, 3, 4])]))).toMatch(/not look like a InkQuiet backup/);
    expect(await msg(new Blob([(await makeZip([{ name: 'x.txt', data: 'y' }])) as BlobPart]))).toMatch(/not a InkQuiet backup/);
    const future = await makeZip([{ name: 'pagenest-backup.json', data: JSON.stringify({ format: 'pagenest-backup', version: 99 }) }]);
    expect(await msg(new Blob([future as BlobPart]))).toMatch(/newer InkQuiet/);
    await fill();
    const good = new Uint8Array(await (await createBackup(db, files)).arrayBuffer());
    const target = (await readZipEntries(new Blob([good as BlobPart]))).find((e) => e.name.startsWith('files/books/') && e.size > 20);
    const at = (target?.localOffset ?? 0) + 30 + new TextEncoder().encode(target?.name ?? '').length + 10;
    const damaged = good.slice();
    damaged[at] = (damaged[at] as number) ^ 0xff; // flip a byte inside a stored file
    expect(await msg(new Blob([damaged as BlobPart]))).toMatch(/damaged/);
    fresh.close();
    await fresh.delete();
  });

  it('writes ZIP64 structures when sizes pass the 4 GB limit (checked with a low threshold)', async () => {
    await fill();
    const zip = await createBackup(db, files, undefined, undefined, 64);
    const entries = await readZipEntries(zip);
    expect(entries.length).toBeGreaterThan(5);
    const db2 = new PageNestDB(`z64-${counter}-${Math.random()}`);
    try {
      const summary = (await restoreBackup(zip, depsFor(db2, new MemoryFileStore()))) as RestoreSummary;
      expect(summary.booksAdded).toBe(3);
    } finally {
      db2.close();
      await db2.delete();
    }
  });
});

describe('housekeeping', () => {
  it('splits storage by kind and frees only caches', async () => {
    await run([item(await makeEpub({ cover: png }), 'a'), item(makeMp3({ title: 'x', frames: 80 }), 'b')]);
    await files.write('renders/b/1.opus', new Uint8Array(1000));
    const usage = await storageBreakdown(db, files);
    expect(usage.books).toBeGreaterThan(0);
    expect(usage.audio).toBeGreaterThan(0);
    expect(usage.covers).toBeGreaterThan(0);
    expect(usage.caches).toBe(1000);
    expect(await clearCaches(db, files)).toBe(1000);
    expect((await storageBreakdown(db, files)).caches).toBe(0);
    expect(await db.books.count()).toBe(2);
  });
  it('plain text with a byte order mark keeps its words', async () => {
    const { outcomes } = await run([item(makeText('Hello'), 'a.txt')]);
    expect(outcomes[0]?.status).toBe('added');
  });
});
