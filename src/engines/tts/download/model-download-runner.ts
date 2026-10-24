import type { ProgressReport } from '@/app/contracts';
import {
  transitionModelDownload,
  type ModelDownloadCheckpoint,
  type ModelDownloadState,
  type VoiceModelManifest,
} from '../model-download';
import { fetchContentLength, fetchRange } from './range-fetch';
import {
  checkpointPath,
  parseCheckpoint,
  serializeCheckpoint,
  sha256Hex,
  type VoiceStorage,
} from './opfs-voice-storage';

export interface ModelDownloadRunnerOptions {
  readonly storage: VoiceStorage;
  readonly manifest: VoiceModelManifest;
  readonly baseUrl: string;
  readonly signal?: AbortSignal;
  readonly onState?: (state: ModelDownloadState) => void;
}

function voiceRoot(manifest: VoiceModelManifest): string {
  return `voices/${manifest.engine}/${manifest.voiceId}`;
}

function fileUrl(baseUrl: string, relativePath: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}/${relativePath}`;
}

/**
 * Runs a voice model download with quota check, resumable Range GET, SHA-256 verify, OPFS writes.
 * `baseUrl` is injected at runtime (no CDN URL in the repo).
 */
export class ModelDownloadRunner {
  private state: ModelDownloadState;
  private aborted = false;

  constructor(private readonly options: ModelDownloadRunnerOptions) {
    const { manifest } = options;
    this.state = {
      phase: 'idle',
      engine: manifest.engine,
      voiceId: manifest.voiceId,
      manifest,
    };
  }

  getState(): ModelDownloadState {
    return this.state;
  }

  cancel(): void {
    this.aborted = true;
    this.state = transitionModelDownload(this.state, { type: 'user-cancelled' });
    this.emit();
  }

  private emit(): void {
    this.options.onState?.(this.state);
  }

  async start(): Promise<ModelDownloadState> {
    this.aborted = false;
    this.state = transitionModelDownload(this.state, { type: 'request-download' });
    this.emit();

    const estimate = await this.options.storage.estimate();
    await this.options.storage.requestPersistent();
    this.state = transitionModelDownload(this.state, {
      type: 'quota-known',
      freeBytes: estimate.quota - estimate.usage,
    });
    this.emit();
    if (this.state.phase === 'failed') {
      return this.state;
    }

    this.state = transitionModelDownload(this.state, { type: 'user-confirmed' });
    this.emit();

    const root = voiceRoot(this.options.manifest);
    let receivedTotal = 0;
    const total = this.options.manifest.totalBytes;

    try {
      for (const file of this.options.manifest.files) {
        if (this.aborted || this.options.signal?.aborted) {
          this.state = transitionModelDownload(this.state, { type: 'user-cancelled' });
          this.emit();
          return this.state;
        }

        const url = fileUrl(this.options.baseUrl, file.relativePath);
        const dest = `${root}/${file.relativePath}`;
        const ckPath = checkpointPath(root, file.relativePath);
        let startByte = 0;
        let etag: string | undefined;

        if (await this.options.storage.files.exists(ckPath)) {
          const ck = parseCheckpoint(
            new TextDecoder().decode(await this.options.storage.files.read(ckPath)),
          );
          startByte = ck.receivedBytes;
          etag = ck.etag;
        }

        if (startByte === 0) {
          const headLen = await fetchContentLength(url, this.options.signal);
          if (headLen !== undefined && headLen !== file.sizeBytes) {
            this.state = transitionModelDownload(this.state, {
              type: 'fail',
              code: 'network',
              message: 'The voice file size does not match the catalog.',
            });
            this.emit();
            return this.state;
          }
        }

        while (startByte < file.sizeBytes) {
          const chunk = await fetchRange({
            url,
            startByte,
            etag,
            signal: this.options.signal,
            onProgress: (p) => {
              receivedTotal = p.receivedBytes;
              const progress: ProgressReport = { done: receivedTotal, total };
              this.state = transitionModelDownload(this.state, {
                type: 'progress',
                progress,
                receivedBytes: receivedTotal,
              });
              this.emit();
            },
          });

          if (chunk.bytes.length === 0) {
            break;
          }

          const existing =
            startByte > 0 && (await this.options.storage.files.exists(dest))
              ? await this.options.storage.files.read(dest)
              : new Uint8Array(0);
          const merged = new Uint8Array(existing.length + chunk.bytes.length);
          merged.set(existing);
          merged.set(chunk.bytes, existing.length);
          await this.options.storage.files.write(dest, merged);

          startByte = merged.length;
          etag = chunk.etag ?? etag;
          const checkpoint: ModelDownloadCheckpoint = {
            voiceId: this.options.manifest.voiceId,
            filePath: file.relativePath,
            receivedBytes: startByte,
            etag,
            updatedAt: Date.now(),
          };
          await this.options.storage.files.write(
            ckPath,
            new TextEncoder().encode(serializeCheckpoint(checkpoint)),
          );
        }

        const written = await this.options.storage.files.read(dest);
        const digest = await sha256Hex(written);
        if (digest !== file.sha256) {
          this.state = transitionModelDownload(this.state, {
            type: 'verify-failed',
            message: 'The downloaded voice file did not pass the integrity check.',
          });
          this.emit();
          return this.state;
        }
        await this.options.storage.files.remove(ckPath);
      }

      this.state = transitionModelDownload(this.state, { type: 'verify-started' });
      this.emit();
      this.state = transitionModelDownload(this.state, {
        type: 'verify-succeeded',
        installedAt: Date.now(),
      });
      this.emit();
      return this.state;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed.';
      this.state = transitionModelDownload(this.state, {
        type: 'fail',
        code: 'network',
        message,
      });
      this.emit();
      return this.state;
    }
  }

  async deleteInstalled(): Promise<ModelDownloadState> {
    this.state = transitionModelDownload(this.state, { type: 'delete-requested' });
    this.emit();
    const root = voiceRoot(this.options.manifest);
    for (const file of this.options.manifest.files) {
      const dest = `${root}/${file.relativePath}`;
      await this.options.storage.files.remove(dest);
      await this.options.storage.files.remove(checkpointPath(root, file.relativePath));
    }
    this.state = transitionModelDownload(this.state, { type: 'delete-completed' });
    this.emit();
    return this.state;
  }
}
