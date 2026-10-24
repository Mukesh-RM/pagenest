import { describe, expect, it, vi } from 'vitest';
import { CoverUrlCache } from './cover-url';

function setup(maxIdle = 2) {
  let n = 0;
  const created: string[] = [];
  const revoked: string[] = [];
  const covers = new Map<string, Blob>([['a', new Blob(['a'])], ['b', new Blob(['b'])], ['c', new Blob(['c'])], ['d', new Blob(['d'])]]);
  const load = vi.fn(async (id: string) => covers.get(id));
  const cache = new CoverUrlCache({
    load,
    maxIdle,
    createObjectURL: () => {
      const url = `blob:${(n += 1)}`;
      created.push(url);
      return url;
    },
    revokeObjectURL: (u) => revoked.push(u),
  });
  return { cache, load, created, revoked, covers };
}

describe('CoverUrlCache', () => {
  it('shares one URL between users and keeps it until the last one lets go and room is needed', async () => {
    const { cache, load, created, revoked } = setup();
    const one = await cache.acquire('a');
    const two = await cache.acquire('a');
    expect(one?.url).toBe(two?.url);
    expect(load).toHaveBeenCalledTimes(1);
    one?.release();
    one?.release(); // twice is harmless
    two?.release();
    expect(revoked).toEqual([]);
    const again = await cache.acquire('a');
    expect(again?.url).toBe(created[0]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('loads once for simultaneous requests', async () => {
    const { cache, load } = setup();
    const [x, y] = await Promise.all([cache.acquire('a'), cache.acquire('a')]);
    expect(x?.url).toBe(y?.url);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('revokes the least recently used idle cover beyond the limit, never one in use', async () => {
    const { cache, revoked, created } = setup(2);
    const held = await cache.acquire('a');
    for (const id of ['b', 'c', 'd']) (await cache.acquire(id))?.release();
    // Idle: b, c, d with room for 2 -> b goes. a is held and survives.
    expect(revoked).toEqual([created[1]]);
    expect(cache.size).toBe(3);
    // Letting go makes a the newest idle one, so the oldest idle (c) goes now.
    held?.release();
    expect(revoked).toEqual([created[1], created[2]]);
    expect(cache.size).toBe(2);
  });

  it('a book without a cover gives undefined and keeps nothing', async () => {
    const { cache } = setup();
    expect(await cache.acquire('none')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('invalidate revokes an idle cover at once and loads the new image next time', async () => {
    const { cache, revoked, created, covers } = setup();
    (await cache.acquire('a'))?.release();
    covers.set('a', new Blob(['new']));
    cache.invalidate('a');
    expect(revoked).toEqual([created[0]]);
    const fresh = await cache.acquire('a');
    expect(fresh?.url).toBe(created[1]);
  });

  it('invalidate keeps the old URL working for whoever shows it, and revokes it afterwards', async () => {
    const { cache, revoked, created } = setup();
    const shown = await cache.acquire('a');
    cache.invalidate('a');
    expect(revoked).toEqual([]);
    expect(cache.size).toBe(1);
    const next = await cache.acquire('a');
    expect(next?.url).toBe(created[1]);
    shown?.release();
    expect(revoked).toEqual([created[0]]);
    expect(cache.size).toBe(1);
  });

  it('a cover changed while it loads is not handed out stale', async () => {
    let open: () => void = () => {};
    const gate = new Promise<void>((r) => (open = r));
    let loads = 0;
    let urls = 0;
    const revoked: string[] = [];
    const cache = new CoverUrlCache({
      load: async () => {
        loads += 1;
        if (loads === 1) await gate; // the first read is slow and will be out of date
        return new Blob(['x']);
      },
      createObjectURL: () => `blob:v${(urls += 1)}`,
      revokeObjectURL: (u) => revoked.push(u),
    });
    const pending = cache.acquire('a');
    await Promise.resolve();
    cache.invalidate('a');
    open();
    const lease = await pending;
    expect(loads).toBe(2);
    expect(lease?.url).toBe('blob:v1'); // only the fresh image ever became a URL
    expect(urls).toBe(1);
    expect(revoked).toEqual([]);
  });

  it('dispose revokes everything and stops handing out URLs', async () => {
    const { cache, revoked, created } = setup();
    const held = await cache.acquire('a');
    (await cache.acquire('b'))?.release();
    cache.invalidate('a');
    cache.dispose();
    expect(new Set(revoked)).toEqual(new Set(created));
    expect(cache.size).toBe(0);
    held?.release();
    expect(revoked).toHaveLength(created.length); // nothing revoked twice
    expect(await cache.acquire('c')).toBeUndefined();
  });

  it('dispose while loading hands out nothing', async () => {
    const { cache, created } = setup();
    const pending = cache.acquire('a');
    cache.dispose();
    expect(await pending).toBeUndefined();
    expect(created).toEqual([]);
  });

  it('uses the browser URL functions by default', async () => {
    // jsdom has no object URLs; give it stand-ins to watch.
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    const create = vi.fn(() => 'blob:default');
    const revoke = vi.fn();
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    try {
      const cache = new CoverUrlCache({ load: async () => new Blob(['x']) });
      (await cache.acquire('a'))?.release();
      cache.dispose();
      expect(create).toHaveBeenCalledTimes(1);
      expect(revoke).toHaveBeenCalledWith('blob:default');
    } finally {
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    }
  });
});
