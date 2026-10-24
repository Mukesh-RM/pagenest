import type { PiperVoiceConfig } from './piper-voice-config';

export type PiperWorkerRequest =
  | {
      readonly type: 'init';
      readonly requestId: string;
      readonly modelBytes: ArrayBuffer;
      readonly config: PiperVoiceConfig;
      readonly ortWasmBaseUrl?: string;
    }
  | {
      readonly type: 'synthesize';
      readonly requestId: string;
      readonly jobId: string;
      readonly phonemeIds: Int32Array;
      readonly speakerId?: number;
    }
  | {
      readonly type: 'enqueue';
      readonly requestId: string;
      readonly jobId: string;
      readonly phonemeIds: Int32Array;
      readonly speakerId?: number;
    }
  | { readonly type: 'cancel'; readonly requestId: string; readonly jobId?: string }
  | { readonly type: 'dispose'; readonly requestId: string };

export type PiperWorkerResponse =
  | { readonly type: 'ready'; readonly requestId: string }
  | {
      readonly type: 'synthesized';
      readonly requestId: string;
      readonly jobId: string;
      readonly samples: Float32Array;
      readonly sampleRate: number;
      readonly durationSec: number;
    }
  | {
      readonly type: 'progress';
      readonly requestId: string;
      readonly queueDepth: number;
      readonly activeJobId: string | undefined;
    }
  | {
      readonly type: 'error';
      readonly requestId: string;
      readonly jobId?: string;
      readonly message: string;
      readonly code: 'failed' | 'aborted' | 'unavailable';
    };
