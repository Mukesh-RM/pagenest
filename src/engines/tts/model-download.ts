/**
 * Typed model-download flow for Piper/Kokoro voices (design only — no network I/O).
 * Implementation will live in a worker + OPFS layer in Phase 4.
 *
 * @see docs/NARRATION_SPIKE.md — “Model download flow”
 */

import type { ProgressReport } from '@/app/contracts';
import type { VoiceEngineId } from './types';

/** Relative path under the OPFS narration root for one voice package. */
export interface VoiceModelManifest {
  readonly engine: VoiceEngineId;
  readonly voiceId: string;
  readonly displayName: string;
  readonly language: string;
  /** Total bytes when all listed files are present. */
  readonly totalBytes: number;
  readonly files: readonly VoiceModelFileDescriptor[];
  /** SHA-256 hex digest of the concatenated file bytes in `files` order, or per-file digests only. */
  readonly integrity: VoiceModelIntegrity;
}

export interface VoiceModelFileDescriptor {
  readonly relativePath: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface VoiceModelIntegrity {
  readonly algorithm: 'sha256';
  readonly files: Readonly<Record<string, string>>;
}

export type ModelDownloadPhase =
  | 'idle'
  | 'checking-quota'
  | 'awaiting-user-consent'
  | 'downloading'
  | 'verifying'
  | 'installed'
  | 'failed'
  | 'deleting';

export interface ModelDownloadStateBase {
  readonly engine: VoiceEngineId;
  readonly voiceId: string;
  readonly manifest: VoiceModelManifest;
}

export interface ModelDownloadIdle extends ModelDownloadStateBase {
  readonly phase: 'idle';
}

export interface ModelDownloadCheckingQuota extends ModelDownloadStateBase {
  readonly phase: 'checking-quota';
}

export interface ModelDownloadAwaitingConsent extends ModelDownloadStateBase {
  readonly phase: 'awaiting-user-consent';
  readonly sizeBytes: number;
  readonly freeBytes: number | undefined;
}

export interface ModelDownloadActive extends ModelDownloadStateBase {
  readonly phase: 'downloading';
  readonly progress: ProgressReport;
  readonly resumable: boolean;
  readonly receivedBytes: number;
}

export interface ModelDownloadVerifying extends ModelDownloadStateBase {
  readonly phase: 'verifying';
}

export interface ModelDownloadInstalled extends ModelDownloadStateBase {
  readonly phase: 'installed';
  readonly installedAt: number;
}

export interface ModelDownloadFailed extends ModelDownloadStateBase {
  readonly phase: 'failed';
  readonly code: ModelDownloadErrorCode;
  readonly message: string;
}

export interface ModelDownloadDeleting extends ModelDownloadStateBase {
  readonly phase: 'deleting';
}

export type ModelDownloadState =
  | ModelDownloadIdle
  | ModelDownloadCheckingQuota
  | ModelDownloadAwaitingConsent
  | ModelDownloadActive
  | ModelDownloadVerifying
  | ModelDownloadInstalled
  | ModelDownloadFailed
  | ModelDownloadDeleting;

export type ModelDownloadErrorCode =
  | 'quota-exceeded'
  | 'network'
  | 'integrity'
  | 'cancelled'
  | 'unsupported';

/** User-visible actions the UI may dispatch (reducer-style, no fetch). */
export type ModelDownloadAction =
  | { readonly type: 'request-download' }
  | { readonly type: 'user-confirmed' }
  | { readonly type: 'user-cancelled' }
  | { readonly type: 'quota-known'; readonly freeBytes: number }
  | { readonly type: 'progress'; readonly progress: ProgressReport; readonly receivedBytes: number }
  | { readonly type: 'verify-started' }
  | { readonly type: 'verify-succeeded'; readonly installedAt: number }
  | { readonly type: 'verify-failed'; readonly message: string }
  | { readonly type: 'fail'; readonly code: ModelDownloadErrorCode; readonly message: string }
  | { readonly type: 'delete-requested' }
  | { readonly type: 'delete-completed' }
  | { readonly type: 'reset' };

export interface ModelDownloadTransitionContext {
  readonly now: () => number;
}

const defaultNow = () => Date.now();

/**
 * Pure state machine for model downloads. Network and OPFS code will call these
 * transitions from a worker; the UI only renders `phase` and forwards actions.
 */
export function transitionModelDownload(
  state: ModelDownloadState,
  action: ModelDownloadAction,
  context: ModelDownloadTransitionContext = { now: defaultNow },
): ModelDownloadState {
  const base = {
    engine: state.engine,
    voiceId: state.voiceId,
    manifest: state.manifest,
  };

  switch (action.type) {
    case 'reset':
      return { ...base, phase: 'idle' };
    case 'request-download':
      if (state.phase !== 'idle' && state.phase !== 'failed') {
        return state;
      }
      return { ...base, phase: 'checking-quota' };
    case 'quota-known': {
      if (state.phase !== 'checking-quota') {
        return state;
      }
      const sizeBytes = state.manifest.totalBytes;
      if (action.freeBytes < sizeBytes) {
        return {
          ...base,
          phase: 'failed',
          code: 'quota-exceeded',
          message: 'Not enough storage for this voice. Free space or remove another voice.',
        };
      }
      return {
        ...base,
        phase: 'awaiting-user-consent',
        sizeBytes,
        freeBytes: action.freeBytes,
      };
    }
    case 'user-confirmed':
      if (state.phase !== 'awaiting-user-consent') {
        return state;
      }
      return {
        ...base,
        phase: 'downloading',
        progress: { done: 0, total: state.manifest.totalBytes },
        resumable: true,
        receivedBytes: 0,
      };
    case 'progress':
      if (state.phase !== 'downloading') {
        return state;
      }
      return {
        ...base,
        phase: 'downloading',
        progress: action.progress,
        resumable: true,
        receivedBytes: action.receivedBytes,
      };
    case 'user-cancelled':
      if (state.phase === 'downloading' || state.phase === 'awaiting-user-consent') {
        return {
          ...base,
          phase: 'failed',
          code: 'cancelled',
          message: 'Download cancelled.',
        };
      }
      return state;
    case 'verify-started':
      if (state.phase !== 'downloading') {
        return state;
      }
      return { ...base, phase: 'verifying' };
    case 'verify-succeeded':
      if (state.phase !== 'verifying') {
        return state;
      }
      return { ...base, phase: 'installed', installedAt: context.now() };
    case 'verify-failed':
      return {
        ...base,
        phase: 'failed',
        code: 'integrity',
        message: action.message,
      };
    case 'fail':
      return { ...base, phase: 'failed', code: action.code, message: action.message };
    case 'delete-requested':
      if (state.phase !== 'installed' && state.phase !== 'failed') {
        return state;
      }
      return { ...base, phase: 'deleting' };
    case 'delete-completed':
      return { ...base, phase: 'idle' };
    default:
      return state;
  }
}

/** HTTP Range resume metadata stored beside partial files in OPFS. */
export interface ModelDownloadCheckpoint {
  readonly voiceId: string;
  readonly filePath: string;
  readonly receivedBytes: number;
  readonly etag: string | undefined;
  readonly updatedAt: number;
}
