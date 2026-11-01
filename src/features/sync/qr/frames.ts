import { parseEncrypted, serializeEncrypted, type EncryptedSyncBlob } from '@/workers/sync/crypto';

/** Conservative max length for one QR frame (JSON chunk of the encrypted envelope). */
export const QR_CHUNK_CHARS = 900;

export interface QrFrameSet {
  total: number;
  frames: string[];
}

/** Split encrypted sync JSON into animated QR frames. */
export function chunkEncryptedForQr(encrypted: EncryptedSyncBlob): QrFrameSet {
  const raw = serializeEncrypted(encrypted);
  const frames: string[] = [];
  for (let i = 0; i < raw.length; i += QR_CHUNK_CHARS) {
    frames.push(raw.slice(i, i + QR_CHUNK_CHARS));
  }
  const total = frames.length;
  return {
    total,
    frames: frames.map((chunk, index) => `PN1|${index + 1}|${total}|${chunk}`),
  };
}

const FRAME_RE = /^PN1\|(\d+)\|(\d+)\|([\s\S]+)$/;

export function parseQrFrame(text: string): { index: number; total: number; chunk: string } | undefined {
  const m = FRAME_RE.exec(text.trim());
  if (!m) return undefined;
  return { index: Number(m[1]), total: Number(m[2]), chunk: m[3] as string };
}

export class QrReassembler {
  private readonly parts = new Map<number, string>();
  private total = 0;

  push(frameText: string): EncryptedSyncBlob | undefined {
    const frame = parseQrFrame(frameText);
    if (!frame || frame.index < 1 || frame.total < 1) return undefined;
    if (this.total === 0) this.total = frame.total;
    if (frame.total !== this.total) return undefined;
    this.parts.set(frame.index, frame.chunk);
    if (this.parts.size < this.total) return undefined;
    let raw = '';
    for (let i = 1; i <= this.total; i += 1) {
      const part = this.parts.get(i);
      if (part === undefined) return undefined;
      raw += part;
    }
    return parseEncrypted(raw);
  }

  reset(): void {
    this.parts.clear();
    this.total = 0;
  }
}

/** WebRTC signaling frames (offer / answer SDP), also chunked. */
export function chunkSignalForQr(kind: 'offer' | 'answer', sdp: string): QrFrameSet {
  const prefix = kind === 'offer' ? 'PNO' : 'PNA';
  const frames: string[] = [];
  for (let i = 0; i < sdp.length; i += QR_CHUNK_CHARS) {
    frames.push(sdp.slice(i, i + QR_CHUNK_CHARS));
  }
  const total = frames.length;
  return {
    total,
    frames: frames.map((chunk, index) => `${prefix}|${index + 1}|${total}|${chunk}`),
  };
}

const SIGNAL_RE = /^(PNO|PNA)\|(\d+)\|(\d+)\|([\s\S]+)$/;

export function parseSignalFrame(text: string): { kind: 'offer' | 'answer'; index: number; total: number; chunk: string } | undefined {
  const m = SIGNAL_RE.exec(text.trim());
  if (!m) return undefined;
  return { kind: m[1] === 'PNO' ? 'offer' : 'answer', index: Number(m[2]), total: Number(m[3]), chunk: m[4] as string };
}

export class SignalReassembler {
  private kind: 'offer' | 'answer' | undefined;
  private readonly parts = new Map<number, string>();
  private total = 0;

  push(frameText: string): { kind: 'offer' | 'answer'; sdp: string } | undefined {
    const frame = parseSignalFrame(frameText);
    if (!frame) return undefined;
    if (!this.kind) this.kind = frame.kind;
    if (frame.kind !== this.kind) return undefined;
    if (this.total === 0) this.total = frame.total;
    if (frame.total !== this.total) return undefined;
    this.parts.set(frame.index, frame.chunk);
    if (this.parts.size < this.total) return undefined;
    let sdp = '';
    for (let i = 1; i <= this.total; i += 1) {
      const part = this.parts.get(i);
      if (part === undefined) return undefined;
      sdp += part;
    }
    return { kind: this.kind, sdp };
  }

  reset(): void {
    this.kind = undefined;
    this.parts.clear();
    this.total = 0;
  }
}
