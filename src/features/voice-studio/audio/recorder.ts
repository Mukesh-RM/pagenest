import { encodeWavMono } from './wav-encode';

export interface RecordedClip {
  readonly blob: Blob;
  readonly durationSec: number;
  readonly sampleRate: number;
}

export interface VoiceRecorderOptions {
  readonly sampleRate?: number;
  readonly maxDurationSec?: number;
}

/** Collect PCM from an open mic stream, then encode WAV on stop. */
export class VoiceRecorder {
  private ctx: AudioContext | undefined;
  private stream: MediaStream | undefined;
  private chunks: Float32Array[] = [];
  private sampleRate: number;
  private maxDurationSec: number;
  private startedAt = 0;
  private raf = 0;
  private onLevel: ((level: number) => void) | undefined;

  constructor(options: VoiceRecorderOptions = {}) {
    this.sampleRate = options.sampleRate ?? 48_000;
    this.maxDurationSec = options.maxDurationSec ?? 120;
  }

  /** 0..1 RMS level for UI meter. */
  setLevelListener(fn: ((level: number) => void) | undefined): void {
    this.onLevel = fn;
  }

  async attach(stream: MediaStream): Promise<void> {
    await this.dispose();
    this.stream = stream;
    this.ctx = new AudioContext({ sampleRate: this.sampleRate });
    const source = this.ctx.createMediaStreamSource(stream);
    const processor = this.ctx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (ev) => {
      const input = ev.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(input));
      if (this.onLevel) {
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i]! * input[i]!;
        this.onLevel(Math.min(1, Math.sqrt(sum / input.length) * 4));
      }
      if ((performance.now() - this.startedAt) / 1000 > this.maxDurationSec) void this.stop();
    };
    source.connect(processor);
    processor.connect(this.ctx.destination);
    this.startedAt = performance.now();
  }

  async stop(): Promise<RecordedClip> {
    cancelAnimationFrame(this.raf);
    const ctx = this.ctx;
    const rate = ctx?.sampleRate ?? this.sampleRate;
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const merged = new Float32Array(total);
    let offset = 0;
    for (const c of this.chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    this.chunks = [];
    await this.dispose(false);
    const blob = encodeWavMono(merged, rate);
    return { blob, durationSec: merged.length / rate, sampleRate: rate };
  }

  async dispose(closeStream = true): Promise<void> {
    if (this.ctx) {
      await this.ctx.close().catch(() => undefined);
      this.ctx = undefined;
    }
    if (closeStream && this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
      this.stream = undefined;
    }
  }
}

/** Lazy entry: recording code loads only when the user starts a session. */
export async function loadVoiceRecorder(): Promise<typeof VoiceRecorder> {
  return VoiceRecorder;
}
