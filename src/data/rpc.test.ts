// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createRpcClient, RpcError, serveRpc, type RpcPort } from './rpc';

interface Api {
  add(a: number, b: number): number;
  slow(ms: number): Promise<string>;
  fail(): never;
  failWithCode(): never;
  size(blob: Blob): number;
}

const impl: Api = {
  add: (a, b) => a + b,
  slow: (ms) => new Promise((r) => setTimeout(() => r(`done ${ms}`), ms)),
  fail: () => {
    throw new RangeError('nope');
  },
  failWithCode: () => {
    throw Object.assign(new Error('missing'), { name: 'FileStoreError', code: 'not-found' });
  },
  size: (blob) => blob.size,
};

const METHODS = ['add', 'slow', 'fail', 'failWithCode', 'size'] as const;

function pair(): { client: ReturnType<typeof createRpcClient<Api>>; stop: () => void; ports: [MessagePort, MessagePort] } {
  const channel = new MessageChannel();
  const stop = serveRpc(channel.port1 as RpcPort, impl);
  const client = createRpcClient<Api>(channel.port2 as RpcPort, METHODS);
  return { client, stop, ports: [channel.port1, channel.port2] };
}

describe('typed RPC', () => {
  it('calls a method and returns its result', async () => {
    const { client, ports } = pair();
    expect(await client.api.add(2, 3)).toBe(5);
    client.close();
    ports.forEach((p) => p.close());
  });

  it('matches answers to calls when they finish out of order', async () => {
    const { client, ports } = pair();
    const [slow, fast] = await Promise.all([client.api.slow(30), client.api.slow(1)]);
    expect([slow, fast]).toEqual(['done 30', 'done 1']);
    client.close();
    ports.forEach((p) => p.close());
  });

  it('passes the error name and message across', async () => {
    const { client, ports } = pair();
    const error = await client.api.fail().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RpcError);
    expect(error).toMatchObject({ name: 'RangeError', message: 'nope' });
    client.close();
    ports.forEach((p) => p.close());
  });

  it('keeps an error code', async () => {
    const { client, ports } = pair();
    const error = (await client.api.failWithCode().catch((e: unknown) => e)) as RpcError;
    expect(error.name).toBe('FileStoreError');
    expect(error.code).toBe('not-found');
    client.close();
    ports.forEach((p) => p.close());
  });

  it('sends a Blob (structured clone) and rejects unknown methods', async () => {
    const channel = new MessageChannel();
    serveRpc(channel.port1 as RpcPort, impl);
    const client = createRpcClient<Api & { nothing(): void }>(channel.port2 as RpcPort, ['size', 'nothing']);
    expect(await client.api.size(new Blob(['hello']))).toBe(5);
    await expect(client.api.nothing()).rejects.toThrow('Unknown method "nothing"');
    client.close();
    channel.port1.close();
    channel.port2.close();
  });

  it('rejects waiting calls when the client is closed, and stops serving when told to', async () => {
    const { client, stop, ports } = pair();
    const waiting = client.api.slow(50);
    client.close();
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
    stop();
    ports.forEach((p) => p.close());
  });

  describe('nested namespaces', () => {
    class Counter {
      private total = 0;
      add(n: number): number {
        this.total += n;
        return this.total;
      }
      boom(): never {
        throw Object.assign(new Error('bad'), { name: 'CounterError', code: 'too-big' });
      }
    }
    interface Nested {
      top(): string;
      counter: Counter;
      deep: { inner: { twice(n: number): number } };
    }
    const nested: Nested = { top: () => 'top', counter: new Counter(), deep: { inner: { twice: (n) => n * 2 } } };
    const PATHS = ['top', 'counter.add', 'counter.boom', 'deep.inner.twice'] as const;

    function open() {
      const channel = new MessageChannel();
      serveRpc(channel.port1 as RpcPort, nested);
      const client = createRpcClient<Nested>(channel.port2 as RpcPort, PATHS);
      return { client, close: () => { client.close(); channel.port1.close(); channel.port2.close(); } };
    }

    it('calls methods inside namespaces, with `this` kept', async () => {
      const { client, close } = open();
      expect(await client.api.top()).toBe('top');
      expect(await client.api.counter.add(2)).toBe(2);
      expect(await client.api.counter.add(3)).toBe(5);
      expect(await client.api.deep.inner.twice(21)).toBe(42);
      close();
    });

    it('keeps error name and code from a namespaced method', async () => {
      const { client, close } = open();
      await expect(client.api.counter.boom()).rejects.toMatchObject({ name: 'CounterError', code: 'too-big', message: 'bad' });
      close();
    });

    it('refuses unknown paths and names every object has', async () => {
      const channel = new MessageChannel();
      serveRpc(channel.port1 as RpcPort, nested);
      const answers = new Map<number, { ok: boolean; message: string }>();
      channel.port2.addEventListener('message', (e: MessageEvent) => {
        const d = e.data as { id: number; ok: boolean; error?: { message: string } };
        answers.set(d.id, { ok: d.ok, message: d.error?.message ?? '' });
      });
      channel.port2.start();
      // Raw requests, the way a hostile or buggy sender could post them.
      const names = ['nope.x', 'constructor', 'counter.constructor', 'counter.toString', '__proto__.x', 'counter.prototype', 'top.length', 'counter.total', 'hasOwnProperty'];
      names.forEach((method, id) => channel.port2.postMessage({ pnRpc: 'request', id, method, args: [] }));
      await vi.waitFor(() => expect(answers.size).toBe(names.length));
      for (const [id, name] of names.entries()) {
        expect(answers.get(id), name).toMatchObject({ ok: false, message: `Unknown method "${name}".` });
      }
      channel.port1.close();
      channel.port2.close();
    });
  });
});
