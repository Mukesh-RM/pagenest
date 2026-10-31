import type { DataClient } from '@/data/data-client';
import type { PackProgress } from '../types';
import { bergamotModelPath } from '../pack-paths';
import type { BergamotRegistry, BergamotRegistryFile, BergamotRegistryPair } from './registry-types';

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyOptionalHash(buffer: ArrayBuffer, expectedHex: string | undefined): Promise<void> {
  if (!expectedHex) return;
  const actual = await sha256Hex(buffer);
  if (actual !== expectedHex.toLowerCase()) {
    throw new Error('Downloaded translation model failed checksum verification.');
  }
}

function listModelFiles(pair: BergamotRegistryPair | undefined): BergamotRegistryFile[] {
  if (!pair) return [];
  return Object.values(pair).filter((f): f is BergamotRegistryFile => Boolean(f?.name));
}

export function bergamotPairDownloadBytes(registry: BergamotRegistry, pairKeys: readonly string[]): number {
  let total = 0;
  for (const key of pairKeys) {
    for (const file of listModelFiles(registry[key])) total += file.size;
  }
  return total;
}

async function fetchFile(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal, credentials: 'omit' });
  if (!res.ok) throw new Error(`Could not download ${url}`);
  return res.arrayBuffer();
}

/** Ensures every Bergamot blob for the given registry keys is stored under OPFS. */
export async function ensureBergamotModelsOnDevice(
  registry: BergamotRegistry,
  pairKeys: readonly string[],
  data: DataClient,
  options?: { signal?: AbortSignal; onProgress?: (p: PackProgress) => void; lexiconBytes?: number },
): Promise<void> {
  const files: BergamotRegistryFile[] = [];
  for (const key of pairKeys) {
    files.push(...listModelFiles(registry[key]));
  }
  const lexiconBytes = options?.lexiconBytes ?? 0;
  const total = lexiconBytes + files.reduce((sum, f) => sum + f.size, 0);
  let received = lexiconBytes;

  const report = () => options?.onProgress?.({ received, total });

  for (const file of files) {
    const path = bergamotModelPath(file.name);
    try {
      await data.openFile(path);
      received += file.size;
      report();
      continue;
    } catch {
      /* download */
    }
    const buffer = await fetchFile(file.name, options?.signal);
    await verifyOptionalHash(buffer, file.expectedSha256Hash);
    await data.writeFile(path, buffer);
    received += file.size;
    report();
  }
}

export async function bergamotModelsOnDevice(
  registry: BergamotRegistry,
  pairKeys: readonly string[],
  data: DataClient,
): Promise<boolean> {
  for (const key of pairKeys) {
    for (const file of listModelFiles(registry[key])) {
      const cached = await readBergamotModelFile(data, file.name);
      if (!cached) return false;
    }
  }
  return true;
}

export async function readBergamotModelFile(data: DataClient, modelUrl: string): Promise<ArrayBuffer | undefined> {
  try {
    return await (await data.openFile(bergamotModelPath(modelUrl))).arrayBuffer();
  } catch {
    return undefined;
  }
}
