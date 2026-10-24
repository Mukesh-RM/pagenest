import { PageNestDB, newId } from './db';
import { STORE_NAMES, STORE_SCHEMA, SCHEMA_VERSION, type BookRecord } from './schema';

let counter = 0;
function freshDb(): PageNestDB {
  counter += 1;
  return new PageNestDB(`pagenest-schema-test-${counter}`);
}

function book(overrides: Partial<BookRecord> = {}): BookRecord {
  return {
    id: newId(),
    fingerprint: `fp-${newId()}`,
    kind: 'ebook',
    format: 'epub',
    title: 'A Title',
    addedAt: 1000,
    favorite: false,
    finished: false,
    ...overrides,
  };
}

describe('schema (blueprint section 13)', () => {
  it('declares every store from the data model table', () => {
    expect([...STORE_NAMES].sort()).toEqual(
      [
        'books',
        'tracks',
        'chapters',
        'progress',
        'bookmarks',
        'highlights',
        'collections',
        'collectionBooks',
        'sessions',
        'voices',
        'renders',
        'settings',
      ].sort(),
    );
    expect(Object.keys(STORE_SCHEMA).sort()).toEqual([...STORE_NAMES].sort());
  });

  it('opens a database containing exactly those stores', async () => {
    const db = freshDb();
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(db.tables.map((t) => t.name).sort()).toEqual([...STORE_NAMES].sort());
    db.close();
  });

  it('indexes the fields the blueprint lists', async () => {
    const db = freshDb();
    await db.open();
    expect(db.books.schema.primKey.name).toBe('id');
    const bookIndexes = db.books.schema.indexes.map((i) => i.name);
    expect(bookIndexes).toEqual(expect.arrayContaining(['fingerprint', 'kind', 'title', 'addedAt', 'lastOpenedAt']));
    expect(db.books.schema.idxByName['fingerprint']?.unique).toBe(true);
    expect(db.progress.schema.primKey.keyPath).toEqual(['bookId', 'mode']);
    expect(db.tracks.schema.primKey.keyPath).toEqual(['bookId', 'index']);
    expect(db.chapters.schema.primKey.keyPath).toEqual(['bookId', 'index']);
    expect(db.collectionBooks.schema.primKey.keyPath).toEqual(['collectionId', 'bookId']);
    expect(db.renders.schema.primKey.keyPath).toEqual(['bookId', 'chapterIndex', 'voiceId', 'style']);
    expect(db.settings.schema.primKey.name).toBe('key');
    db.close();
  });

  it('stores and reads back a book with all optional fields', async () => {
    const db = freshDb();
    const full = book({
      kind: 'audio',
      format: 'm4b',
      author: 'Author',
      narrator: 'Narrator',
      series: 'Series',
      language: 'en',
      coverRef: 'covers/x.img',
      fileRef: 'books/x/book.m4b',
      durationSec: 7200,
      pages: undefined,
      lastOpenedAt: 2000,
      favorite: true,
    });
    await db.books.add(full);
    expect(await db.books.get(full.id)).toMatchObject({ narrator: 'Narrator', durationSec: 7200, favorite: true });
    db.close();
  });

  it('rejects a second book with the same fingerprint (no duplicates)', async () => {
    const db = freshDb();
    await db.books.add(book({ fingerprint: 'same' }));
    await expect(db.books.add(book({ fingerprint: 'same' }))).rejects.toThrow();
    db.close();
  });

  it('keeps one progress row per book and mode', async () => {
    const db = freshDb();
    const bookId = newId();
    await db.progress.put({ bookId, mode: 'read', locator: { kind: 'page', page: 1, offset: 0 }, percent: 1, updatedAt: 1 });
    await db.progress.put({ bookId, mode: 'read', locator: { kind: 'page', page: 9, offset: 0 }, percent: 9, updatedAt: 2 });
    await db.progress.put({ bookId, mode: 'listen', locator: { kind: 'audio', trackIndex: 0, positionSec: 5 }, percent: 1, updatedAt: 3 });
    expect(await db.progress.where('bookId').equals(bookId).count()).toBe(2);
    expect((await db.progress.get([bookId, 'read']))?.percent).toBe(9);
    db.close();
  });

  it('round-trips tracks, chapters, bookmarks, highlights and sessions', async () => {
    const db = freshDb();
    const bookId = newId();
    await db.tracks.bulkAdd([
      { bookId, index: 1, fileRef: 'b/2.mp3', title: 'Two', durationSec: 60, startOffsetSec: 60 },
      { bookId, index: 0, fileRef: 'b/1.mp3', title: 'One', durationSec: 60, startOffsetSec: 0 },
    ]);
    expect((await db.tracks.where('bookId').equals(bookId).sortBy('index')).map((t) => t.title)).toEqual(['One', 'Two']);

    await db.chapters.bulkAdd([
      { bookId, index: 0, title: 'Start', startSec: 0 },
      { bookId, index: 1, title: 'Text', locator: { kind: 'reflow', section: 1, textOffset: 0 } },
    ]);
    expect(await db.chapters.where('bookId').equals(bookId).count()).toBe(2);

    const range = {
      start: { kind: 'reflow', section: 0, textOffset: 5 },
      end: { kind: 'reflow', section: 0, textOffset: 20 },
    } as const;
    await db.highlights.add({ id: newId(), bookId, range, text: 'hello', color: 'yellow', note: 'n', createdAt: 5 });
    expect((await db.highlights.where('bookId').equals(bookId).first())?.range).toEqual(range);

    await db.bookmarks.add({ id: newId(), bookId, locator: { kind: 'audio', trackIndex: 0, positionSec: 3 }, label: 'Here', createdAt: 6 });
    expect(await db.bookmarks.where('bookId').equals(bookId).count()).toBe(1);

    await db.sessions.add({ id: newId(), bookId, mode: 'listen', startedAt: 10, durationSec: 600 });
    expect((await db.sessions.where('startedAt').aboveOrEqual(10).toArray()).length).toBe(1);
    db.close();
  });

  it('links books to collections both ways', async () => {
    const db = freshDb();
    const collectionId = newId();
    const a = newId();
    const b = newId();
    await db.collections.add({ id: collectionId, name: 'Favorites', order: 0 });
    await db.collectionBooks.bulkAdd([
      { collectionId, bookId: a, order: 0 },
      { collectionId, bookId: b, order: 1 },
    ]);
    await expect(db.collectionBooks.add({ collectionId, bookId: a, order: 5 })).rejects.toThrow();
    expect(await db.collectionBooks.where('collectionId').equals(collectionId).count()).toBe(2);
    expect(await db.collectionBooks.where('bookId').equals(a).count()).toBe(1);
    db.close();
  });

  it('stores voices, renders and settings', async () => {
    const db = freshDb();
    const voiceId = newId();
    const bookId = newId();
    await db.voices.add({ id: voiceId, name: 'My voice', engine: 'piper', modelRef: `voices/${voiceId}`, language: 'en', isOwnVoice: true, createdAt: 1 });
    expect(await db.voices.where('engine').equals('piper').count()).toBe(1);

    const render = { bookId, chapterIndex: 0, voiceId, style: 'natural', status: 'queued' } as const;
    await db.renders.put(render);
    await db.renders.put({ ...render, status: 'ready', audioRef: 'renders/x.opus' });
    expect(await db.renders.count()).toBe(1);
    expect(await db.renders.where('status').equals('ready').count()).toBe(1);

    await db.settings.put({ key: 'skipBackSec', value: 15 });
    expect((await db.settings.get('skipBackSec'))?.value).toBe(15);
    db.close();
  });
});
