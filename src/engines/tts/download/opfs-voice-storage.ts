import type { ModelDownloadCheckpoint } from '../model-download';

export interface VoiceStorageFile {
  write(path: string, data: Uint8Array, append?: boolean): Promise<void>;
  read(path: string): Promise<Uint8Array>;
  remove(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export interface VoiceStorageQuota {
  readonly usage: number;
  readonly quota: number;
}

export interface VoiceStorage {
  readonly files: VoiceStorageFile;
  estimate(): Promise<VoiceStorageQuota>;
  requestPersistent(): Promise<boolean>;
}

const CHECKPOINT = '.checkpoint.json';

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256HexFile(
  storage: VoiceStorageFile,
  path: string,
  chunkSize = 256 * 1024,
): Promise<string> {
  const all = await storage.read(path);
  if (all.length <= chunkSize) {
    return sha256Hex(all);
  }
  return sha256Hex(all);
}

export function checkpointPath(voiceRoot: string, relativeFile: string): string {
  return `${voiceRoot}/${relativeFile}.${CHECKPOINT}`;
}

export function parseCheckpoint(json: string): ModelDownloadCheckpoint {
  return JSON.parse(json) as ModelDownloadCheckpoint;
}

export function serializeCheckpoint(checkpoint: ModelDownloadCheckpoint): string {
  return JSON.stringify(checkpoint);
}
