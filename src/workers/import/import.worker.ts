import { PageNestDB } from '@/data/db';
import { createFileStore, openOpfsRoot } from '@/data/opfs';
import { createRpcClient, type RpcPort } from '@/data/rpc';
import { createStreamWriter } from './opfs-stream';
import type { WorkerEvent, WorkerRequest } from './protocol';
import { createImportService } from './service';
import { makeThumbnail } from './thumbnail';
import type { ParsedMeta } from './types';

/**
 * The import worker. Owns its own IndexedDB connection and the OPFS file store, does the heavy work
 * (sniffing, hashing, parsing, copying, backup) and posts events back. Audio tags come from a nested
 * worker that is only started the first time an audio file arrives.
 */
interface AudioApi {
  parseAudio(file: Blob): Promise<ParsedMeta>;
}

let audio: { api: { parseAudio: (file: Blob) => Promise<ParsedMeta> }; failed: boolean } | undefined;

function audioWorker(): { parseAudio: (file: Blob) => Promise<ParsedMeta> } | undefined {
  if (audio) return audio.failed ? undefined : audio.api;
  try {
    const worker = new Worker(new URL('./audio-metadata.worker.ts', import.meta.url), { type: 'module' });
    const rpc = createRpcClient<AudioApi>(worker as unknown as RpcPort, ['parseAudio']);
    audio = { api: rpc.api, failed: false };
    return audio.api;
  } catch {
    audio = { api: { parseAudio: async () => ({}) }, failed: true };
    return undefined;
  }
}

const filesPromise = createFileStore();
const rootPromise = openOpfsRoot();

const service = (async () => {
  const [files, root] = await Promise.all([filesPromise, rootPromise]);
  return createImportService({
    db: new PageNestDB(),
    files,
    ...(root ? { writeBlob: createStreamWriter(root) } : {}),
    parseAudio: async (blob) => (await audioWorker()?.parseAudio(blob)) ?? {},
    makeThumbnail,
  });
})();

const post = (event: WorkerEvent): void => (self as unknown as { postMessage: (m: WorkerEvent) => void }).postMessage(event);

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  void service.then((s) => s.handle(event.data, post));
});
