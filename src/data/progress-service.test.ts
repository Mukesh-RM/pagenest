import { afterEach, beforeEach, vi } from 'vitest';
import type { Locator, ProgressRecord } from '@/app/contracts';
import { PageNestDB, newId } from './db';
import { DexieProgressService, attachProgressLifecycle, DEFAULT_SAVE_INTERVAL_MS } from './progress-service';

let counter = 0;
let db: PageNestDB;
let clock: number;
let service: DexieProgressService;
const bookId = 'book-1';

const pdf = (n: number): Locator => ({ kind: 'page', page: n, offset: 0 });
const audio = (s: number): Locator => ({ kind: 'audio', trackIndex: 0, positionSec: s });

beforeEach(() => {
  counter += 1;
  db = new PageNestDB(`pagenest-progress-test-${counter}`);
  clock = 1_000;
  service = new DexieProgressService(db, { now: () => clock });
});

afterEach(() => {
  vi.useRealTimers();
  db.close();
});

describe('DexieProgressService', () => {
  it('saves immediately and reads back', async () => {
    const saved = await service.save(bookId, 'read', pdf(7), 33.3);
    expect(saved).toEqual({ bookId, mode: 'read', locator: pdf(7), percent: 33.3, updatedAt: 1000 });
    expect(await service.get(bookId, 'read')).toEqual(saved);
    expect(await service.get(bookId, 'listen')).toBeUndefined();
  });

  it('clamps percent into 0 to 100', async () => {
    expect((await service.save(bookId, 'read', pdf(1), 250)).percent).toBe(100);
    expect((await service.save(bookId, 'read', pdf(1), -3)).percent).toBe(0);
  });

  it('rejects a locator that does not fit the mode', async () => {
    expect(() => service.report(bookId, 'read', audio(5), 1)).toThrow(RangeError);
    await expect(service.save(bookId, 'listen', pdf(1), 1)).rejects.toThrow(RangeError);
    await expect(service.save(bookId, 'read', { kind: 'page', page: 0, offset: 0 }, 1)).rejects.toThrow(RangeError);
  });

  it('writes reports at most once per interval and keeps the newest', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const put = vi.spyOn(db.progress, 'put');
    for (let i = 1; i <= 50; i++) service.report(bookId, 'read', pdf(i), i);
    expect(put).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(DEFAULT_SAVE_INTERVAL_MS - 1);
    expect(put).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await service.flush();

    expect(put).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    expect((await db.progress.get([bookId, 'read']))?.locator).toEqual(pdf(50));
  });

  it('serves a pending report from get() before it is written', async () => {
    service.report(bookId, 'listen', audio(12), 4);
    expect((await service.get(bookId, 'listen'))?.locator).toEqual(audio(12));
    expect(await db.progress.count()).toBe(0);
    await service.flush();
    expect(await db.progress.count()).toBe(1);
  });

  it('flush(bookId) only writes that book', async () => {
    service.report('a', 'read', pdf(2), 2);
    service.report('b', 'read', pdf(3), 3);
    await service.flush('a');
    expect(await db.progress.count()).toBe(1);
    expect((await db.progress.toArray())[0]?.bookId).toBe('a');
    await service.flush();
    expect(await db.progress.count()).toBe(2);
  });

  it('save() discards the pending report for the same key', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    service.report(bookId, 'read', pdf(2), 2);
    await service.save(bookId, 'read', pdf(9), 9);
    await vi.advanceTimersByTimeAsync(DEFAULT_SAVE_INTERVAL_MS + 10);
    vi.useRealTimers();
    expect((await db.progress.get([bookId, 'read']))?.locator).toEqual(pdf(9));
  });

  it('keeps read, listen and aloud positions apart and returns the latest', async () => {
    clock = 100;
    await service.save(bookId, 'read', pdf(5), 10);
    clock = 300;
    await service.save(bookId, 'listen', audio(60), 5);
    clock = 200;
    await service.save(bookId, 'aloud', { kind: 'reflow', section: 1, textOffset: 0, sentence: 3 }, 8);
    expect(await db.progress.count()).toBe(3);
    expect((await service.getLatest(bookId))?.mode).toBe('listen');
    expect(await service.getLatest('missing')).toBeUndefined();
  });

  it('touches lastOpenedAt on the book when it exists', async () => {
    await db.books.add({
      id: bookId,
      fingerprint: 'f',
      kind: 'pdf',
      format: 'pdf',
      title: 'T',
      addedAt: 1,
      favorite: false,
      finished: false,
    });
    clock = 5555;
    await service.save(bookId, 'read', pdf(1), 1);
    expect((await db.books.get(bookId))?.lastOpenedAt).toBe(5555);
  });

  it('notifies subscribers after each write and stops after unsubscribe', async () => {
    const seen: ProgressRecord[] = [];
    const off = service.subscribe((r) => seen.push(r));
    await service.save(bookId, 'read', pdf(2), 2);
    off();
    off();
    await service.save(bookId, 'read', pdf(3), 3);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.locator).toEqual(pdf(2));
  });

  it('never lets an older save overwrite a newer one', async () => {
    const first = service.save(bookId, 'read', pdf(1), 1);
    const second = service.save(bookId, 'read', pdf(2), 2);
    await Promise.all([first, second]);
    expect((await db.progress.get([bookId, 'read']))?.locator).toEqual(pdf(2));
  });

  it('clear() removes saved and pending positions of a book', async () => {
    await service.save(bookId, 'read', pdf(1), 1);
    service.report(bookId, 'listen', audio(3), 1);
    await service.clear(bookId);
    await service.flush();
    expect(await db.progress.where('bookId').equals(bookId).count()).toBe(0);
  });

  it('ignores stored rows with a damaged locator', async () => {
    await db.progress.put({
      bookId,
      mode: 'read',
      locator: { kind: 'page', page: -4, offset: 0 } as Locator,
      percent: 1,
      updatedAt: 1,
    });
    expect(await service.get(bookId, 'read')).toBeUndefined();
    expect(await service.getLatest(bookId)).toBeUndefined();
  });

  it('works with a random book id from newId()', async () => {
    const id = newId();
    await service.save(id, 'read', pdf(1), 1);
    expect((await service.get(id, 'read'))?.bookId).toBe(id);
  });
});

describe('attachProgressLifecycle', () => {
  function fakeTarget() {
    const handlers = new Map<string, () => void>();
    return {
      visibilityState: 'visible' as string,
      addEventListener: (type: string, fn: () => void) => void handlers.set(type, fn),
      removeEventListener: (type: string) => void handlers.delete(type),
      fire: (type: string) => handlers.get(type)?.(),
      has: (type: string) => handlers.has(type),
    };
  }

  it('flushes when the page is hidden or closed, and detaches cleanly', async () => {
    const flush = vi.fn(() => Promise.resolve());
    const fake = { flush } as unknown as DexieProgressService;
    const doc = fakeTarget();
    const win = fakeTarget();
    const detach = attachProgressLifecycle(fake, { visibility: doc, page: win });

    doc.fire('visibilitychange');
    expect(flush).not.toHaveBeenCalled();
    doc.visibilityState = 'hidden';
    doc.fire('visibilitychange');
    expect(flush).toHaveBeenCalledTimes(1);
    win.fire('pagehide');
    expect(flush).toHaveBeenCalledTimes(2);

    detach();
    expect(doc.has('visibilitychange')).toBe(false);
    expect(win.has('pagehide')).toBe(false);
  });
});
