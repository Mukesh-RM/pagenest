/**
 * Small byte helpers shared by the sniffer and the parsers. Everything reads through
 * `Blob.slice`, so only the bytes that are needed are ever loaded (never the whole file).
 * No DOM and no network: it runs in a worker, in Node tests, anywhere with Blob.
 */

/** Read `length` bytes starting at `start`. Shorter at the end of the file. */
export async function readRange(blob: Blob, start: number, length: number): Promise<Uint8Array> {
  const from = Math.max(0, Math.min(start, blob.size));
  const to = Math.max(from, Math.min(blob.size, start + length));
  return new Uint8Array(await blob.slice(from, to).arrayBuffer());
}

export function u16le(b: Uint8Array, at: number): number {
  return (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8);
}

export function u32le(b: Uint8Array, at: number): number {
  return ((b[at] ?? 0) | ((b[at + 1] ?? 0) << 8) | ((b[at + 2] ?? 0) << 16) | ((b[at + 3] ?? 0) << 24)) >>> 0;
}

export function u64le(b: Uint8Array, at: number): number {
  return u32le(b, at) + u32le(b, at + 4) * 4294967296;
}

export function u16be(b: Uint8Array, at: number): number {
  return ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0);
}

export function u32be(b: Uint8Array, at: number): number {
  return (((b[at] ?? 0) << 24) | ((b[at + 1] ?? 0) << 16) | ((b[at + 2] ?? 0) << 8) | (b[at + 3] ?? 0)) >>> 0;
}

export function u64be(b: Uint8Array, at: number): number {
  return u32be(b, at) * 4294967296 + u32be(b, at + 4);
}

/** Latin-1 text of `b[start, end)`. Used for ASCII signatures. */
export function ascii(b: Uint8Array, start: number, end: number): string {
  let out = '';
  for (let i = start; i < Math.min(end, b.length); i += 1) out += String.fromCharCode(b[i] ?? 0);
  return out;
}

export function startsWith(b: Uint8Array, signature: string, at = 0): boolean {
  if (b.length < at + signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) if (b[at + i] !== signature.charCodeAt(i)) return false;
  return true;
}

/** Index of `needle` (Latin-1) in `b`, or -1. */
export function indexOfAscii(b: Uint8Array, needle: string, from = 0): number {
  const n = needle.length;
  outer: for (let i = from; i <= b.length - n; i += 1) {
    for (let j = 0; j < n; j += 1) if (b[i + j] !== needle.charCodeAt(j)) continue outer;
    return i;
  }
  return -1;
}

/** Decode with a label such as `utf-8` or `windows-1251`; unknown labels fall back to UTF-8. */
export function decodeText(b: Uint8Array, label = 'utf-8'): string {
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(label);
  } catch {
    decoder = new TextDecoder('utf-8');
  }
  return decoder.decode(b);
}

/** Decode XML bytes, honoring a BOM or the `encoding` in the XML declaration. */
export function decodeXml(b: Uint8Array): string {
  if (b[0] === 0xff && b[1] === 0xfe) return decodeText(b, 'utf-16le');
  if (b[0] === 0xfe && b[1] === 0xff) return decodeText(b, 'utf-16be');
  const head = ascii(b, 0, 200);
  const declared = /<\?xml[^>]*encoding\s*=\s*["']([\w.:-]+)["']/i.exec(head)?.[1];
  return decodeText(b, declared ?? 'utf-8');
}

/** True when the bytes are well-formed UTF-8. A multi-byte character cut off at the very end is allowed. */
export function isValidUtf8(b: Uint8Array): boolean {
  let i = 0;
  while (i < b.length) {
    const c = b[i] as number;
    let need: number;
    if (c < 0x80) need = 0;
    else if (c >= 0xc2 && c <= 0xdf) need = 1;
    else if (c >= 0xe0 && c <= 0xef) need = 2;
    else if (c >= 0xf0 && c <= 0xf4) need = 3;
    else return false;
    for (let k = 1; k <= need; k += 1) {
      const next = b[i + k];
      if (next === undefined) return true; // sample ended inside a character
      if ((next & 0xc0) !== 0x80) return false;
    }
    i += need + 1;
  }
  return true;
}

/** Read a stream fully, up to `maxBytes`. Cancels the stream when the limit is reached. */
export async function readStream(stream: ReadableStream<Uint8Array>, maxBytes = Infinity): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
    if (total >= maxBytes) {
      await reader.cancel().catch(() => undefined);
      break;
    }
  }
  const out = new Uint8Array(Math.min(total, maxBytes));
  let at = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.length, out.length - at);
    if (take <= 0) break;
    out.set(chunk.subarray(0, take), at);
    at += take;
  }
  return out;
}

/** Natural, case-insensitive order: `track2` before `track10`. */
export const naturalCompare = (a: string, b: string): number =>
  a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
