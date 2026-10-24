// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
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
