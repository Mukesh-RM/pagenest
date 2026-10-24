// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BookRepository } from '@/data/books';
import { CollectionRepository } from '@/data/collections';
import { PageNestDB } from '@/data/db';
import { MemoryFileStore } from '@/data/opfs';
import { parseAudio } from '@/workers/import/parsers/audio';
import type { ImportItem, ItemOutcome, WorkerEvent } from '@/workers/import/protocol';
import { createImportService } from '@/workers/import/service';
import { concat, makeMp3, makeMp4Audio, makePng } from '@/workers/import/testing/fixtures';
import { AudioItemError, loadAudioItem, type AudioItemSource } from './audio-item';

let db: PageNestDB;
let files: MemoryFileStore;
let books: BookRepository;
let n = 0;

beforeEach(() => {
  n += 1;
  db = new PageNestDB(`audio-item-${n}-${Math.random()}`);
  files = new MemoryFileStore();
  books = new BookRepository(db, files);
});
afterEach(async () => {
  db.close();
  await db.delete();
});

const source = (): AudioItemSource => ({ books, openFile: (path) => files.open(path) });
const item = (bytes: Uint8Array, name: string, relPath?: string, type = ''): ImportItem => ({ file: new File([bytes as BlobPart], name, { type }), ...(relPath ? { relPath } : {}) });
const noProbe = { probeDuration: async () => undefined };

/** The real import path (sniffing, tags, OPFS, rows), so these tests read what the importer really stores. */
async function importAll(items: ImportItem[]): Promise<ItemOutcome[]> {
  const service = createImportService({ db, files, books, collections: new CollectionRepository(db), parseAudio, makeThumbnail: async () => undefined });
  const events: WorkerEvent[] = [];
  await service.handle({ type: 'import', jobId: 'j', items }, (e) => events.push(e));
  return events.flatMap((e) => (e.type === 'outcome' ? [e.outcome] : []));
}
const addedId = (o: ItemOutcome | undefined): string => {
  if (o?.status !== 'added') throw new Error(`not added: ${JSON.stringify(o)}`);
  return o.book.id;
};
const bytesOf = async (b: Blob): Promise<Uint8Array> => new Uint8Array(await b.arrayBuffer());

describe('loadAudioItem: one file', () => {
  it('builds the player item for an M4B: title, author, narrator, length, chapters, cover and a track that reads the file from OPFS', async () => {
    const m4b = makeMp4Audio({ brand: 'M4B ', album: 'Long Walk', title: 'Long Walk', seconds: 90, chapters: [['Intro', 0], ['Part two', 30.5]] });
    const [outcome] = await importAll([item(m4b, 'x.m4b')]);
    const id = addedId(outcome);
    const result = await loadAudioItem(source(), id, noProbe);
    expect(result.bookId).toBe(id);
    expect(result.title).toBe('Long Walk');
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toMatchObject({ index: 0, startOffsetSec: 0 });
    expect(result.tracks[0]?.durationSec).toBeGreaterThan(80);
    expect(result.chapters.map((c) => [c.index, c.title, c.startSec])).toEqual([[0, 'Intro', 0], [1, 'Part two', 30.5]]);
    const blob = await result.tracks[0]?.open();
    expect(blob?.size).toBe(m4b.length);
    expect(blob?.type).toBe('audio/mp4');
    expect(await bytesOf(blob as Blob)).toEqual(m4b);
  });

  it('plays an M4B that is named like an MP3 (the bytes decide) with its true type and chapters', async () => {
    const m4b = makeMp4Audio({ brand: 'M4B ', album: 'Disguised', seconds: 60, chapters: [['One', 0], ['Two', 20]] });
    const [outcome] = await importAll([item(m4b, 'talk.mp3', undefined, 'audio/mpeg')]);
    const result = await loadAudioItem(source(), addedId(outcome), noProbe);
    expect(result.title).toBe('Disguised');
    expect(result.chapters.map((c) => c.title)).toEqual(['One', 'Two']);
    expect((await result.tracks[0]?.open())?.type).toBe('audio/mp4');
  });

  it('plays an MP3 with no extension, no tags and no chapters, with evenly spaced markers', async () => {
    const mp3 = makeMp3({ frames: 400, id3: false });
    const [outcome] = await importAll([item(mp3, 'README', undefined, 'text/plain')]);
    const result = await loadAudioItem(source(), addedId(outcome), noProbe);
    expect(result.tracks[0]?.durationSec).toBeGreaterThan(5);
    expect((await result.tracks[0]?.open())?.type).toBe('audio/mpeg');
    expect(result.chapters).toHaveLength(8);
    expect(result.chapters[0]).toEqual({ index: 0, title: 'Part 1', startSec: 0 });
    const last = result.chapters.at(-1);
    expect(last?.startSec).toBeLessThan(result.tracks[0]?.durationSec ?? 0);
  });

  it('carries author, narrator and cover from the stored book', async () => {
    const [outcome] = await importAll([item(makeMp3({ title: 'Ch', album: 'Voiced', artist: 'The Author', frames: 120 }), 'a.mp3')]);
    const id = addedId(outcome);
    const cover = new Blob([await makePng(4, 6)], { type: 'image/png' });
    await books.setCover(id, cover);
    await books.update(id, { narrator: 'The Narrator' });
    const result = await loadAudioItem(source(), id, noProbe);
    expect(result).toMatchObject({ title: 'Voiced', author: 'The Author', narrator: 'The Narrator' });
    expect(result.cover?.size).toBe(cover.size);
  });

  it('measures a length that was not stored, from the file, and uses it for the markers', async () => {
    const [outcome] = await importAll([item(makeMp3({ frames: 50, id3: false }), 'a.mp3')]);
    const id = addedId(outcome);
    await db.tracks.where('bookId').equals(id).modify({ durationSec: 0 });
    await db.books.update(id, { durationSec: 0 });
    const probed: number[] = [];
    const result = await loadAudioItem(source(), id, { probeDuration: async (blob) => (probed.push(blob.size), 240) });
    expect(probed).toHaveLength(1);
    expect(result.tracks[0]?.durationSec).toBe(240);
    expect(result.chapters).toHaveLength(8);
    expect(result.chapters[1]?.startSec).toBe(30);
  });

  it('falls back to the stored book length for a single file with no stored track length', async () => {
    const [outcome] = await importAll([item(makeMp3({ frames: 50, id3: false }), 'a.mp3')]);
    const id = addedId(outcome);
    await db.tracks.where('bookId').equals(id).modify({ durationSec: 0 });
    await db.books.update(id, { durationSec: 123 });
    const result = await loadAudioItem(source(), id, { probeDuration: async () => assertNever() });
    expect(result.tracks[0]?.durationSec).toBe(123);
  });

  it('works for a book that only has fileRef (no track rows)', async () => {
    const [outcome] = await importAll([item(makeMp3({ frames: 60 }), 'a.mp3')]);
    const id = addedId(outcome);
    const book = await books.get(id);
    await db.tracks.where('bookId').equals(id).delete();
    await db.books.update(id, { fileRef: 'books/legacy/book.mp3', durationSec: 77 });
    await files.write('books/legacy/book.mp3', new Uint8Array([1, 2, 3]));
    const result = await loadAudioItem(source(), id, noProbe);
    expect(book?.id).toBe(id);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toMatchObject({ durationSec: 77, title: book?.title });
    expect((await result.tracks[0]?.open())?.size).toBe(3);
  });
});

describe('loadAudioItem: a book made of many files', () => {
  it('keeps the files in natural order, with running offsets and one chapter per file', async () => {
    const parts = [10, 2, 1].map((i) => item(makeMp3({ title: `Part ${i}`, album: 'Folder Book', artist: 'Someone', frames: 200 + i }), `Track ${i}.dat`, `Folder Book/Track ${i}.dat`));
    const outcomes = await importAll(parts);
    const id = addedId(outcomes.find((o) => o.status === 'added'));
    const result = await loadAudioItem(source(), id, noProbe);
    expect(result.title).toBe('Folder Book');
    expect(result.tracks.map((t) => t.title)).toEqual(['Part 1', 'Part 2', 'Part 10']);
    let sum = 0;
    for (const t of result.tracks) {
      expect(t.startOffsetSec).toBeCloseTo(sum, 6);
      sum += t.durationSec;
    }
    expect(result.chapters.map((c) => c.title)).toEqual(['Part 1', 'Part 2', 'Part 10']);
    expect(result.chapters.map((c) => c.startSec)).toEqual(result.tracks.map((t) => t.startOffsetSec));
    const sizes = await Promise.all(result.tracks.map(async (t) => (await t.open()).size));
    expect(sizes).toEqual([makeMp3({ frames: 201 }).length, makeMp3({ frames: 202 }).length, makeMp3({ frames: 210 }).length].map((x, i) => (x > 0 ? sizes[i] : 0)));
    expect(new Set(sizes).size).toBe(3);
  });

  it('puts chapters that sit inside a file at book time, in order', async () => {
    const [outcome] = await importAll([item(makeMp3({ frames: 300 }), 'a.mp3')]);
    const id = addedId(outcome);
    await db.chapters.where('bookId').equals(id).delete();
    await db.chapters.bulkPut([
      { bookId: id, index: 1, title: 'Later', startSec: 5 },
      { bookId: id, index: 0, title: 'Earlier', startSec: 2 },
      { bookId: id, index: 2, title: 'No time' },
    ]);
    const result = await loadAudioItem(source(), id, noProbe);
    expect(result.chapters.map((c) => [c.index, c.title, c.startSec])).toEqual([[0, 'Earlier', 2], [1, 'Later', 5]]);
  });

  it('turns a track-and-position chapter into book time', async () => {
    const outcomes = await importAll([1, 2].map((i) => item(makeMp3({ title: `T${i}`, album: 'Two Parts', frames: 200 }), `t${i}.mp3`, `Two Parts/t${i}.mp3`)));
    const id = addedId(outcomes.find((o) => o.status === 'added'));
    await db.chapters.where('bookId').equals(id).delete();
    const tracks = await books.getTracks(id);
    await db.chapters.bulkPut([{ bookId: id, index: 0, title: 'Second file, 3 s in', locator: { kind: 'audio', trackIndex: 1, positionSec: 3 } }]);
    const result = await loadAudioItem(source(), id, noProbe);
    expect(result.chapters).toEqual([{ index: 0, title: 'Second file, 3 s in', startSec: (tracks[1]?.startOffsetSec ?? 0) + 3 }]);
  });
});

describe('loadAudioItem: what it refuses, in words a listener can read', () => {
  it('refuses a missing book, an e-book and a book with no file', async () => {
    await expect(loadAudioItem(source(), 'nope', noProbe)).rejects.toMatchObject({ code: 'not-found' });
    const ebook = await books.add({ fingerprint: 'e1', kind: 'ebook', format: 'epub', title: 'E', addedAt: 1, file: new Blob([concat([1, 2, 3])]), fileName: 'book.epub' });
    await expect(loadAudioItem(source(), ebook.status === 'added' ? ebook.book.id : '', noProbe)).rejects.toMatchObject({ code: 'not-audio' });
    await db.books.put({ id: 'bare', fingerprint: 'b', kind: 'audio', format: 'mp3', title: 'Bare', addedAt: 1, favorite: false, finished: false });
    const error = await loadAudioItem(source(), 'bare', noProbe).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AudioItemError);
    expect((error as AudioItemError).code).toBe('no-files');
    expect((error as Error).message).toMatch(/no audio file/i);
  });

  it('says so when the file is gone from the device, when the player asks for it', async () => {
    const [outcome] = await importAll([item(makeMp3({ frames: 60 }), 'a.mp3')]);
    const id = addedId(outcome);
    const result = await loadAudioItem(source(), id, noProbe);
    const ref = (await books.getTracks(id))[0]?.fileRef as string;
    await files.remove(ref);
    await expect(result.tracks[0]?.open()).rejects.toMatchObject({ code: 'file-missing' });
  });
});

function assertNever(): never {
  throw new Error('should not probe');
}
