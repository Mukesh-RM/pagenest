import type { VoiceModelManifest } from '../model-download';
import { ModelDownloadRunner } from './model-download-runner';
import type { VoiceStorage } from './opfs-voice-storage';

export type ModelDownloadWorkerRequest =
  | {
      readonly type: 'download';
      readonly requestId: string;
      readonly manifest: VoiceModelManifest;
      readonly baseUrl: string;
    }
  | { readonly type: 'cancel'; readonly requestId: string }
  | {
      readonly type: 'delete';
      readonly requestId: string;
      readonly manifest: VoiceModelManifest;
    };

export type ModelDownloadWorkerResponse =
  | {
      readonly type: 'state';
      readonly requestId: string;
      readonly state: ReturnType<ModelDownloadRunner['getState']>;
    }
  | { readonly type: 'error'; readonly requestId: string; readonly message: string };

let runner: ModelDownloadRunner | undefined;
let storage: VoiceStorage | undefined;

export function attachModelDownloadStorage(next: VoiceStorage): void {
  storage = next;
}

function post(message: ModelDownloadWorkerResponse): void {
  self.postMessage(message);
}

self.onmessage = (event: MessageEvent<ModelDownloadWorkerRequest>) => {
  const msg = event.data;
  if (!storage) {
    post({ type: 'error', requestId: msg.requestId, message: 'Voice storage is not ready.' });
    return;
  }
  switch (msg.type) {
    case 'download':
      runner = new ModelDownloadRunner({
        storage,
        manifest: msg.manifest,
        baseUrl: msg.baseUrl,
        onState: (state) => post({ type: 'state', requestId: msg.requestId, state }),
      });
      void runner.start();
      break;
    case 'cancel':
      runner?.cancel();
      break;
    case 'delete':
      runner = new ModelDownloadRunner({
        storage,
        manifest: msg.manifest,
        baseUrl: '',
        onState: (state) => post({ type: 'state', requestId: msg.requestId, state }),
      });
      void runner.deleteInstalled();
      break;
    default:
      break;
  }
};
