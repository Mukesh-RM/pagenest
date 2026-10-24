// @vitest-environment node
import { describe, expect, it } from 'vitest';
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
});
