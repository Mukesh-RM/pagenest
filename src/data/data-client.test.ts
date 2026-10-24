// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDataClient, createWorkerFileStore } from './data-client';
import { createDataService } from './data-service';
import { PageNestDB } from './db';
import { MemoryFileStore } from './opfs';
import { serveRpc, type RpcPort } from './rpc';

const dbs: PageNestDB[] = [];
function freshDb(): PageNestDB {
  const db = new PageNestDB(`client-${Math.random()}`);
  dbs.push(db);
  return db;
}
afterEach(async () => {
  for (const db of dbs.splice(0)) {
    db.close();
    await db.delete();
  }
});

/** A stand-in for `new Worker(...)`: the service runs behind a MessageChannel, so messages are really cloned. */
function fakeWorker(db: PageNestDB, files = new MemoryFileStore()) {
  const channel = new MessageChannel();
  serveRpc(channel.port1 as RpcPort, createDataService({ db, files }));
  let terminated = 0;
  const port = Object.assign(channel.port2 as RpcPort, {
    terminate: () => {
      terminated += 1;
      channel.port1.close();
      channel.port2.close();
    },
  });
  return { port, terminated: () => terminated };
}

describe('DataClient with a worker', () => {
  it('does not start the worker until the first call', async () => {
    let created = 0;
    const db = freshDb();
    const client = createDataClient({
      workerFactory: () => {
        created += 1;
        return fakeWorker(db).port;
      },
    });
    expect(created).toBe(0);
    await client.fileStoreInfo();
    await client.fileStoreInfo();
    expect(created).toBe(1);
    expect(client.usesWorker).toBe(true);
    client.close();
  });

  it('fingerprints a Blob through the worker', async () => {
    const client = createDataClient({ workerFactory: () => fakeWorker(freshDb()).port });
    expect(await client.fingerprint(new Blob(['abc']))).toBe('3-ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    client.close();
  });

  it('writes, reads, lists and removes files through the worker', async () => {
    const client = createDataClient({ workerFactory: () => fakeWorker(freshDb()).port });
    await client.writeFile('books/a.txt', 'hello');
    expect(await client.fileExists('books/a.txt')).toBe(true);
    expect(await client.fileSize('books/a.txt')).toBe(5);
    const file = await client.openFile('books/a.txt');
    expect(await file.text()).toBe('hello');
    expect((await client.listFiles('books')).map((e) => e.name)).toEqual(['a.txt']);
    expect(await client.fileUsage()).toBe(5);
    await client.removeFile('books/a.txt');
    expect(await client.fileExists('books/a.txt')).toBe(false);
    client.close();
  });

  it('surfaces errors from the worker with their code', async () => {
    const client = createDataClient({ workerFactory: () => fakeWorker(freshDb()).port });
    await expect(client.openFile('nope.txt')).rejects.toMatchObject({ name: 'FileStoreError', code: 'not-found' });
    await expect(client.writeFile('../escape', 'x')).rejects.toMatchObject({ code: 'invalid-path' });
    client.close();
  });

  it('computes stats from the worker database', async () => {
    const db = freshDb();
    await db.sessions.add({ id: 's1', bookId: 'b', mode: 'listen', startedAt: Date.now(), durationSec: 120 });
    const client = createDataClient({ workerFactory: () => fakeWorker(db).port });
    const stats = await client.stats(Date.now());
    expect(stats.sessionCount).toBe(1);
    expect(stats.minutesPerDay[6]).toBe(2);
    client.close();
  });

  it('close() terminates the worker and a later call starts a new one', async () => {
    const db = freshDb();
    const made: ReturnType<typeof fakeWorker>[] = [];
    const client = createDataClient({
      workerFactory: () => {
        const w = fakeWorker(db);
        made.push(w);
        return w.port;
      },
    });
    await client.fileStoreInfo();
    client.close();
    expect(made[0]?.terminated()).toBe(1);
    await client.fileStoreInfo();
    expect(made).toHaveLength(2);
    client.close();
  });

  it('works as a plain FileStore', async () => {
    const client = createDataClient({ workerFactory: () => fakeWorker(freshDb()).port });
    const store = createWorkerFileStore(client, await client.fileStoreInfo());
    await store.write('covers/c.bin', new Uint8Array([1, 2, 3]));
    expect(await store.size('covers/c.bin')).toBe(3);
    expect(store.kind).toBe('memory');
    client.close();
  });
});

describe('DataClient without Worker support', () => {
  it('runs the same service in-process', async () => {
    const client = createDataClient({ workerFactory: () => undefined, db: freshDb(), files: new MemoryFileStore() });
    expect(client.usesWorker).toBe(false);
    await client.writeFile('a.txt', 'abc');
    expect(await client.fileSize('a.txt')).toBe(3);
    expect(await client.fingerprint(new Blob(['abc']))).toMatch(/^3-/);
    await expect(client.openFile('missing')).rejects.toMatchObject({ code: 'not-found' });
  });

  it('falls back in-process when starting the worker throws', async () => {
    const client = createDataClient({
      workerFactory: () => {
        throw new Error('blocked by policy');
      },
      db: freshDb(),
      files: new MemoryFileStore(),
    });
    expect((await client.stats(Date.now())).finishedBooks).toBe(0);
    expect(client.usesWorker).toBe(false);
  });
});

describe('library APIs through the client', () => {
  const book = (n: number, rest: Record<string, unknown> = {}) => ({
    fingerprint: `fp-${n}`,
    kind: 'ebook' as const,
    format: 'epub' as const,
    title: `Book ${n}`,
    file: new Blob([`bytes ${n}`]),
    fileName: `b${n}.epub`,
    ...rest,
  });

  async function exercise(client: ReturnType<typeof createDataClient>): Promise<void> {
    // add: Blobs cross the boundary, results are plain data.
    const added = await client.books.add(book(1, { author: 'Jane Austen', cover: new Blob(['png']) }));
    if (added.status !== 'added') throw new Error('expected added');
    const id = added.book.id;
    expect(await (await client.openFile(added.book.fileRef as string)).text()).toBe('bytes 1');

    // duplicate is a normal result, not an error
    const dup = await client.books.add(book(2, { fingerprint: 'fp-1' }));
    expect(dup).toMatchObject({ status: 'duplicate', existing: { id } });

    // cover comes back as a Blob
    expect(await (await client.books.getCover(id))?.text()).toBe('png');

    // domain errors keep their name and code
    await expect(client.books.update(id, { title: ' ' })).rejects.toMatchObject({ name: 'BookRepositoryError', code: 'invalid-input' });
    await expect(client.books.update('nope', { favorite: true })).rejects.toMatchObject({ code: 'not-found' });
    await expect(client.collections.create(' ')).rejects.toMatchObject({ name: 'CollectionError', code: 'invalid-name' });

    // shelves and search
    const shelf = await client.collections.create('Classics');
    expect(await client.collections.addBooks(shelf.id, [id, 'zzz'])).toEqual({ added: [id], alreadyThere: [], unknown: ['zzz'] });
    expect((await client.collections.list())[0]).toMatchObject({ name: 'Classics', bookCount: 1 });
    const page = await client.library.query({ text: 'austen', collectionId: shelf.id });
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({ id, percent: 0 });
    expect(await client.library.count()).toBe(1);

    // the library notices changes made through the same service
    await client.books.update(id, { title: 'Emma' });
    expect((await client.library.query({ text: 'emma' })).total).toBe(1);

    // delete with undo, as the Library screen does it
    const receipt = await client.books.trash([id]);
    expect((await client.library.query({})).total).toBe(0);
    expect(await client.books.restore(receipt.token)).toEqual({ restored: [id], skipped: [] });
    expect((await client.library.query({})).total).toBe(1);
    const removed = await client.books.remove([id]);
    expect(removed.freedBytes).toBeGreaterThan(0);
    expect(await client.fileUsage()).toBe(0);
    expect((await client.library.query({})).total).toBe(0);
  }

  it('works through a worker', async () => {
    const db = freshDb();
    const client = createDataClient({ workerFactory: () => fakeWorker(db).port });
    await exercise(client);
    expect(client.usesWorker).toBe(true);
    client.close();
  });

  it('works in-process with the same results', async () => {
    const client = createDataClient({ workerFactory: () => undefined, db: freshDb(), files: new MemoryFileStore() });
    await exercise(client);
    expect(client.usesWorker).toBe(false);
    client.close();
  });

  it('an import worker and the data worker share one database, and search sees both', async () => {
    const db = freshDb();
    const client = createDataClient({ workerFactory: () => fakeWorker(db).port });
    expect((await client.library.query({})).total).toBe(0);
    // Another connection (the import worker) writes straight through the repository.
    const other = new PageNestDB(db.name);
    const { BookRepository } = await import('./books');
    await new BookRepository(other, new MemoryFileStore()).add(book(7, { title: 'Imported elsewhere' }));
    other.close();
    await vi.waitFor(async () => expect((await client.library.query({ text: 'elsewhere' })).total).toBe(1));
    client.close();
  });
});
