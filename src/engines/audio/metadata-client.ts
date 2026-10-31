import type { AudioChapter } from './types';
import type { MetadataJobKind, MetadataResponse } from './metadata-types';

let nextId = 1;
let worker: Worker | undefined;

function getWorker(): Worker {
  worker ??= new Worker(new URL('./metadata.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

export interface ParseMetadataResult {
  chapters: AudioChapter[];
  durationSec?: number;
}

/**
 * Parse chapters off the main thread (blueprint 12.2). Rejects on worker errors.
 */
export function parseAudioMetadata(blob: Blob, kind: MetadataJobKind): Promise<ParseMetadataResult> {
  return blob.arrayBuffer().then(
    (buffer) =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        const w = getWorker();
        const onMessage = (event: MessageEvent<MetadataResponse>) => {
          if (event.data.id !== id) return;
          w.removeEventListener('message', onMessage);
          if (event.data.error) reject(new Error(event.data.error));
          else resolve({ chapters: event.data.chapters, durationSec: event.data.durationSec });
        };
        w.addEventListener('message', onMessage);
        w.postMessage({ id, kind, buffer }, [buffer]);
      }),
  );
}

/** Terminate the shared worker (tests). */
export function disposeMetadataWorker(): void {
  worker?.terminate();
  worker = undefined;
}
