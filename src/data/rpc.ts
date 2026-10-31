/**
 * A tiny typed request/response layer over `postMessage`, for talking to a Web Worker (or any
 * `MessagePort`-like object). No dependencies, no network code.
 *
 * - `serveRpc(port, impl)` runs in the worker: every method of `impl` becomes callable.
 * - `createRpcClient(port, methods)` runs on the main thread: returns an object with the same
 *   methods, each returning a Promise. Arguments and results must be structured-cloneable
 *   (Blob, File, ArrayBuffer, plain objects), which the types do not enforce, so keep APIs plain.
 * - Errors cross the boundary as `RpcError` with the original `name`, `message` and `code`.
 */

/** The slice of `Worker` / `MessagePort` / `DedicatedWorkerGlobalScope` used here. */
export interface RpcPort {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  /** `MessagePort`s must be started when using addEventListener. */
  start?(): void;
}

interface RpcRequest {
  readonly pnRpc: 'request';
  readonly id: number;
  readonly method: string;
  readonly args: readonly unknown[];
}

interface RpcSuccess {
  readonly pnRpc: 'response';
  readonly id: number;
  readonly ok: true;
  readonly value: unknown;
}

interface RpcFailure {
  readonly pnRpc: 'response';
  readonly id: number;
  readonly ok: false;
  readonly error: { readonly name: string; readonly message: string; readonly code?: string };
}

/**
 * Every method of `T` as an async method with the same arguments. Plain objects inside `T`
 * (for example `books: { add(...): ... }`) become nested objects of async methods.
 */
export type Remote<T> = {
  [K in keyof T as T[K] extends (...args: never[]) => unknown ? K : T[K] extends object ? K : never]: T[K] extends (
    ...args: infer A
  ) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : Remote<T[K]>;
};

/** Dotted names of every method in `T`: `'fingerprint' | 'books.add' | ...`. */
export type MethodPath<T> = {
  [K in keyof T & string]: T[K] extends (...args: never[]) => unknown ? K : T[K] extends object ? `${K}.${MethodPath<T[K]>}` : never;
}[keyof T & string];

/** Error raised on the calling side when the worker's method threw. */
export class RpcError extends Error {
  readonly code: string | undefined;
  constructor(name: string, message: string, code?: string) {
    super(message);
    this.name = name;
    this.code = code;
  }
}

function isRequest(data: unknown): data is RpcRequest {
  return typeof data === 'object' && data !== null && (data as { pnRpc?: unknown }).pnRpc === 'request';
}

function isResponse(data: unknown): data is RpcSuccess | RpcFailure {
  return typeof data === 'object' && data !== null && (data as { pnRpc?: unknown }).pnRpc === 'response';
}

/** Names nobody may call over the port: anything every object has (`constructor`, `toString`, `__proto__`, ...) and `prototype`. */
const isForbidden = (part: string): boolean => part === 'prototype' || part in Object.prototype;

/** Answer calls arriving on `port` using the methods of `impl`. Returns a function that stops serving. */
export function serveRpc<T extends object>(port: RpcPort, impl: T): () => void {
  const listener = (event: MessageEvent): void => {
    const request: unknown = event.data;
    if (!isRequest(request)) return;
    void (async () => {
      try {
        // "books.add" calls impl.books.add with `this` set to impl.books.
        const path = request.method.split('.');
        const name = path.pop() ?? '';
        if ([...path, name].some(isForbidden)) throw new TypeError(`Unknown method "${request.method}".`);
        let owner: unknown = impl;
        for (const part of path) owner = (owner as Record<string, unknown> | undefined)?.[part];
        const method = (owner as Record<string, unknown> | undefined)?.[name];
        if (typeof method !== 'function') {
          throw new TypeError(`Unknown method "${request.method}".`);
        }
        const value: unknown = await (method as (...a: unknown[]) => unknown).apply(owner, [...request.args]);
        port.postMessage({ pnRpc: 'response', id: request.id, ok: true, value } satisfies RpcSuccess);
      } catch (error) {
        const e = error instanceof Error ? error : new Error(String(error));
        const code = (e as { code?: unknown }).code;
        port.postMessage({
          pnRpc: 'response',
          id: request.id,
          ok: false,
          error: { name: e.name, message: e.message, ...(typeof code === 'string' ? { code } : {}) },
        } satisfies RpcFailure);
      }
    })();
  };
  port.addEventListener('message', listener);
  port.start?.();
  return () => port.removeEventListener('message', listener);
}

export interface RpcClient<T> {
  /** The remote methods. */
  readonly api: Remote<T>;
  /** Stop listening; calls still waiting are rejected. */
  close(): void;
}

/**
 * Build a client for the worker on the other end of `port`. `methods` lists the method names
 * (the type `T` is erased at runtime, so they must be named once here).
 */
export function createRpcClient<T extends object>(port: RpcPort, methods: readonly MethodPath<T>[]): RpcClient<T> {
  let nextId = 1;
  const waiting = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();

  const listener = (event: MessageEvent): void => {
    const data: unknown = event.data;
    if (!isResponse(data)) return;
    const call = waiting.get(data.id);
    if (!call) return;
    waiting.delete(data.id);
    if (data.ok) call.resolve(data.value);
    else call.reject(new RpcError(data.error.name, data.error.message, data.error.code));
  };
  port.addEventListener('message', listener);
  port.start?.();

  const api: Record<string, unknown> = {};
  for (const method of methods) {
    const call = (...args: unknown[]): Promise<unknown> =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        waiting.set(id, { resolve, reject });
        port.postMessage({ pnRpc: 'request', id, method, args } satisfies RpcRequest);
      });
    const path = method.split('.');
    const name = path.pop() ?? method;
    let target = api;
    for (const part of path) target = (target[part] ??= {}) as Record<string, unknown>;
    target[name] = call;
  }

  return {
    api: api as Remote<T>,
    close() {
      port.removeEventListener('message', listener);
      for (const call of waiting.values()) call.reject(new RpcError('AbortError', 'The worker was closed.'));
      waiting.clear();
    },
  };
}
