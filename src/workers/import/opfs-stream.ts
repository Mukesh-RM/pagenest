import { parsePath, type FileData, type FileStore } from '@/data/opfs';

/**
 * Copy a blob into the origin private file system chunk by chunk, so a 2 GB audiobook never sits in
 * memory. In a worker it uses a synchronous access handle (fast, and the only option on older
 * Safari); elsewhere it pipes the blob's stream into a writable. No network code.
 */

interface SyncHandle {
  truncate(size: number): void;
  write(data: BufferSource, options?: { at: number }): number;
  flush(): void;
  close(): void;
}

interface FileHandleLike {
  createSyncAccessHandle?: () => Promise<SyncHandle>;
  createWritable?: () => Promise<WritableStream<Uint8Array> & { close(): Promise<void> }>;
}

interface DirectoryLike {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
}

export function createStreamWriter(root: unknown): (path: string, blob: Blob) => Promise<void> {
  const top = root as DirectoryLike;
  return async (path, blob) => {
    const parts = parsePath(path);
    const name = parts.pop() as string;
    let dir = top;
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
    const handle = await dir.getFileHandle(name, { create: true });
    try {
      if (typeof handle.createSyncAccessHandle === 'function') {
        let access: SyncHandle | undefined;
        try {
          access = await handle.createSyncAccessHandle();
        } catch {
          access = undefined; // locked by another tab: use the writable path below
        }
        if (access) {
          try {
            access.truncate(0);
            const reader = (blob.stream() as ReadableStream<Uint8Array>).getReader();
            let at = 0;
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              let written = 0;
              while (written < value.length) {
                const n = access.write((written === 0 ? value : value.subarray(written)) as Uint8Array<ArrayBuffer>, { at: at + written });
                if (n <= 0) throw Object.assign(new Error('The device is out of space.'), { name: 'QuotaExceededError' });
                written += n;
              }
              at += value.length;
            }
            access.flush();
          } finally {
            access.close();
          }
          return;
        }
      }
      if (typeof handle.createWritable === 'function') {
        const writable = await handle.createWritable();
        await (blob.stream() as ReadableStream<Uint8Array>).pipeTo(writable);
        return;
      }
      const error = new Error('This browser cannot save files here.');
      error.name = 'SecurityError';
      throw error;
    } catch (error) {
      await dir.removeEntry(name).catch(() => undefined);
      throw error;
    }
  };
}

/**
 * The data layer's file store, except that writing a Blob copies it in chunks (see above) instead of
 * loading it whole. Everything else is passed straight through, so `BookRepository` works unchanged.
 */
export function streamingFileStore(inner: FileStore, root: unknown): FileStore {
  const stream = createStreamWriter(root);
  return {
    kind: inner.kind,
    persistent: inner.persistent,
    write: (path: string, data: FileData) => (data instanceof Blob ? stream(path, data) : inner.write(path, data)),
    open: (path) => inner.open(path),
    exists: (path) => inner.exists(path),
    size: (path) => inner.size(path),
    remove: (path) => inner.remove(path),
    list: (path) => inner.list(path),
    usage: (path) => inner.usage(path),
  };
}
