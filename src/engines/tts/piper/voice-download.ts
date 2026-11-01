import { voiceError } from '../errors';
import type { PrepareOptions } from '../types';
import { PIPER_MODELS_CHUNK_BYTES, modelPartUrl, modelUrls, piperVoiceById } from './voices';

async function readResponse(
  res: Response,
  options: PrepareOptions | undefined,
  totalHint: number,
): Promise<ArrayBuffer> {
  const total = Number(res.headers.get('content-length') || totalHint || 0);
  const reader = res.body?.getReader();
  if (!reader) return res.arrayBuffer();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      if (total > 0) options?.onProgress?.({ done: received, total });
    }
  }
  const out = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out.buffer;
}

async function fetchBuffer(url: string, options: PrepareOptions | undefined, totalHint = 0): Promise<ArrayBuffer> {
  let res: Response;
  try {
    res = await fetch(url, { signal: options?.signal });
  } catch {
    throw voiceError('failed', 'Could not download the voice. Check your connection or try again on Wi‑Fi.');
  }
  if (!res.ok) {
    const hint =
      res.status === 404
        ? ' Voice files may not be deployed yet (see docs/PIPER_VOICE_HOSTING.md).'
        : '';
    throw voiceError('failed', `Could not download the voice (${res.status}).${hint}`);
  }
  return readResponse(res, options, totalHint);
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Downloads Piper weights from this app origin (single file or chunked parts). */
export async function downloadPiperWeights(voiceId: string, options?: PrepareOptions): Promise<ArrayBuffer> {
  const meta = piperVoiceById(voiceId);
  const urls = modelUrls(voiceId);
  if (!meta || !urls) throw voiceError('voice-not-found', 'That voice is not available.');

  const parts = urls.partCount;
  let buffer: ArrayBuffer;
  if (parts <= 1) {
    buffer = await fetchBuffer(urls.weights, options, meta.sizeBytes);
  } else {
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (let i = 0; i < parts; i += 1) {
      const partUrl = modelPartUrl(voiceId, i);
      if (!partUrl) throw voiceError('failed', 'Voice part URL is missing.');
      const part = await fetchBuffer(partUrl, options, Math.min(PIPER_MODELS_CHUNK_BYTES, meta.sizeBytes - received));
      chunks.push(new Uint8Array(part));
      received += part.byteLength;
      options?.onProgress?.({ done: received, total: meta.sizeBytes });
    }
    const out = new Uint8Array(received);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    buffer = out.buffer;
  }

  if (meta.sha256) {
    const hex = await sha256Hex(buffer);
    if (hex !== meta.sha256) {
      throw voiceError('failed', 'Downloaded voice failed integrity check. Try again.');
    }
  }
  return buffer;
}

export async function fetchPiperConfig(voiceId: string, signal?: AbortSignal): Promise<string> {
  const urls = modelUrls(voiceId);
  if (!urls) throw voiceError('voice-not-found', 'That voice is not available.');
  let res: Response;
  try {
    res = await fetch(urls.config, { signal });
  } catch {
    throw voiceError('failed', 'Could not load the voice configuration. Check your connection.');
  }
  if (!res.ok) throw voiceError('failed', 'Could not load the voice configuration.');
  return res.text();
}
