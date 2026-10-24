import type { VoiceStorage, VoiceStorageFile, VoiceStorageQuota } from './opfs-voice-storage';

/** In-memory voice storage for unit tests (simulates OPFS). */
export function createMemoryVoiceStorage(): VoiceStorage {
  const blobs = new Map<string, Uint8Array>();
  const files: VoiceStorageFile = {
    async write(path, data, append) {
      if (append && blobs.has(path)) {
        const prev = blobs.get(path) ?? new Uint8Array(0);
        const merged = new Uint8Array(prev.length + data.length);
        merged.set(prev);
        merged.set(data, prev.length);
        blobs.set(path, merged);
      } else {
        blobs.set(path, data);
      }
    },
    async read(path) {
      return blobs.get(path) ?? new Uint8Array(0);
    },
    async remove(path) {
      blobs.delete(path);
    },
    async exists(path) {
      return blobs.has(path);
    },
  };
  return {
    files,
    async estimate(): Promise<VoiceStorageQuota> {
      let usage = 0;
      for (const b of blobs.values()) usage += b.length;
      return { usage, quota: 1024 * 1024 * 1024 };
    },
    async requestPersistent() {
      return true;
    },
  };
}
