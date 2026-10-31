import type { FileRef } from '@/app/contracts';
import type { FileData, FileStore } from './opfs';
import { FileStoreError, MemoryFileStore, parsePath } from './opfs';

const CACHE_NAME = 'pagenest-file-bytes-v1';

function cacheUrl(path: FileRef): string {
  return `https://pagenest.invalid/${encodeURI(path)}`;
}

async function toBlob(data: FileData): Promise<Blob> {
  if (data instanceof Blob) return data;
  if (typeof data === 'string') return new Blob([data], { type: 'text/plain' });
  return new Blob([data as BlobPart]);
}

async function openCache(): Promise<Cache> {
  if (typeof caches === 'undefined') throw new FileStoreError('unsupported', 'Cache storage is not available.');
  return caches.open(CACHE_NAME);
}

/**
 * When OPFS is blocked, imports and playback share a memory store; the Cache API keeps bytes across reloads
 * so resume-after-reload works on WebKit/Linux CI (Playwright) and other OPFS-less profiles.
 */
export function createCacheBackedFileStore(memory = new MemoryFileStore()): FileStore {
  return {
    kind: 'memory',
    persistent: true,
    async write(path, data) {
      await memory.write(path, data);
      const blob = await toBlob(data);
      await (await openCache()).put(cacheUrl(path), new Response(blob));
    },
    async open(path) {
      try {
        return await memory.open(path);
      } catch (error) {
        if (!(error instanceof FileStoreError && error.code === 'not-found')) throw error;
        const hit = await (await openCache()).match(cacheUrl(path));
        if (!hit) throw new FileStoreError('not-found', `"${path}" does not exist.`);
        const blob = await hit.blob();
        const parts = parsePath(path);
        const name = parts.at(-1) ?? 'file';
        return new File([blob], name, { type: blob.type });
      }
    },
    async exists(path) {
      if (await memory.exists(path)) return true;
      return (await openCache()).match(cacheUrl(path)) !== undefined;
    },
    async size(path) {
      return (await this.open(path)).size;
    },
    async remove(path) {
      await memory.remove(path);
      await (await openCache()).delete(cacheUrl(path));
    },
    list(path) {
      return memory.list(path);
    },
    usage(path) {
      return memory.usage(path);
    },
  };
}
