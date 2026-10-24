import { readRange, readStream, u16le, u32le, u64le } from './bytes';

/**
 * Minimal ZIP reader and writer (no dependencies, no network).
 *
 * Reader: finds the central directory with one small read from the end of the file and reads
 * single entries on demand with `Blob.slice`, so a 2 GB archive costs no more memory than a
 * tiny one. Deflate is handled by the browser's `DecompressionStream`. ZIP64 is supported.
 *
 * Writer: stores files without compression (books and audio are already compressed), so a
 * backup of many gigabytes is assembled as a `Blob` from file references and never held in memory.
 */

export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipError';
  }
}

export interface ZipEntry {
  readonly name: string;
  /** 0 = stored, 8 = deflate. */
  readonly method: number;
  readonly compressedSize: number;
  readonly size: number;
  readonly localOffset: number;
  readonly isDirectory: boolean;
  readonly encrypted: boolean;
}

const EOCD_SIG = 0x06054b50;
const EOCD64_LOCATOR_SIG = 0x07064b50;
const EOCD64_SIG = 0x06064b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;
const MAX_COMMENT = 0xffff;

/** True when the first bytes look like a ZIP (local header or the end record of an empty archive). */
export function hasZipSignature(head: Uint8Array): boolean {
  return head[0] === 0x50 && head[1] === 0x4b && ((head[2] === 3 && head[3] === 4) || (head[2] === 5 && head[3] === 6));
}

/** Read the list of entries. Throws {@link ZipError} when the archive is damaged. */
export async function readZipEntries(blob: Blob): Promise<ZipEntry[]> {
  const tailLength = Math.min(blob.size, 22 + MAX_COMMENT + 20);
  const tailStart = blob.size - tailLength;
  const tail = await readRange(blob, tailStart, tailLength);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i -= 1) {
    if (u32le(tail, i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError('This ZIP file has no directory.');
  let count = u16le(tail, eocd + 10);
  let cdSize = u32le(tail, eocd + 12);
  let cdOffset = u32le(tail, eocd + 16);

  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    const loc = eocd - 20;
    if (loc >= 0 && u32le(tail, loc) === EOCD64_LOCATOR_SIG) {
      const eocd64Offset = u64le(tail, loc + 8);
      const r = await readRange(blob, eocd64Offset, 56);
      if (u32le(r, 0) !== EOCD64_SIG) throw new ZipError('This ZIP file has a damaged directory.');
      count = u64le(r, 32);
      cdSize = u64le(r, 40);
      cdOffset = u64le(r, 48);
    }
  }
  if (cdOffset + cdSize > blob.size) throw new ZipError('This ZIP file is cut short.');
  const cd = await readRange(blob, cdOffset, cdSize);
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder('utf-8');
  let at = 0;
  while (at + 46 <= cd.length && entries.length < Math.max(count, 0)) {
    if (u32le(cd, at) !== CENTRAL_SIG) throw new ZipError('This ZIP file has a damaged directory.');
    const flags = u16le(cd, at + 8);
    const method = u16le(cd, at + 10);
    let compressedSize = u32le(cd, at + 20);
    let size = u32le(cd, at + 24);
    const nameLength = u16le(cd, at + 28);
    const extraLength = u16le(cd, at + 30);
    const commentLength = u16le(cd, at + 32);
    let localOffset = u32le(cd, at + 42);
    const name = decoder.decode(cd.subarray(at + 46, at + 46 + nameLength));
    if (size === 0xffffffff || compressedSize === 0xffffffff || localOffset === 0xffffffff) {
      let x = at + 46 + nameLength;
      const xEnd = x + extraLength;
      while (x + 4 <= xEnd) {
        const id = u16le(cd, x);
        const len = u16le(cd, x + 2);
        if (id === 1) {
          let p = x + 4;
          if (size === 0xffffffff) {
            size = u64le(cd, p);
            p += 8;
          }
          if (compressedSize === 0xffffffff) {
            compressedSize = u64le(cd, p);
            p += 8;
          }
          if (localOffset === 0xffffffff) localOffset = u64le(cd, p);
          break;
        }
        x += 4 + len;
      }
    }
    entries.push({
      name,
      method,
      compressedSize,
      size,
      localOffset,
      isDirectory: name.endsWith('/'),
      encrypted: (flags & 1) !== 0,
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Bytes of one entry, at most `maxBytes` of it. Throws {@link ZipError} for encrypted or unknown methods. */
export async function readZipEntry(blob: Blob, entry: ZipEntry, maxBytes = Infinity): Promise<Uint8Array> {
  if (entry.encrypted) throw new ZipError('This ZIP entry is password protected.');
  const header = await readRange(blob, entry.localOffset, 30);
  if (u32le(header, 0) !== LOCAL_SIG) throw new ZipError('This ZIP file has a damaged entry.');
  const dataStart = entry.localOffset + 30 + u16le(header, 26) + u16le(header, 28);
  const raw = blob.slice(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return readRange(raw, 0, Math.min(entry.compressedSize, maxBytes));
  if (entry.method === 8) {
    if (typeof DecompressionStream === 'undefined') throw new ZipError('This browser cannot unpack ZIP files.');
    try {
      const stream = raw.stream().pipeThrough(new DecompressionStream('deflate-raw')) as ReadableStream<Uint8Array>;
      return await readStream(stream, maxBytes);
    } catch {
      throw new ZipError('This ZIP file has a damaged entry.');
    }
  }
  throw new ZipError('This ZIP file uses a format PageNest cannot unpack.');
}

/** Find an entry by exact name, then by case-insensitive name. */
export function findEntry(entries: readonly ZipEntry[], name: string): ZipEntry | undefined {
  return entries.find((e) => e.name === name) ?? entries.find((e) => e.name.toLowerCase() === name.toLowerCase());
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

let crcTable: Uint32Array | undefined;

function table(): Uint32Array {
  if (crcTable) return crcTable;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  crcTable = t;
  return t;
}

/** Continue a CRC-32. Start with `0`. */
export function crc32Update(crc: number, data: Uint8Array): number {
  const t = table();
  let c = ~crc >>> 0;
  for (let i = 0; i < data.length; i += 1) c = (t[(c ^ (data[i] as number)) & 0xff] as number) ^ (c >>> 8);
  return ~c >>> 0;
}

/** CRC-32 of a whole blob, read in 1 MB pieces. `onChunk` receives the bytes read so far. */
export async function crc32Blob(blob: Blob, onChunk?: (bytes: number) => void): Promise<number> {
  const reader = (blob.stream() as ReadableStream<Uint8Array>).getReader();
  let crc = 0;
  let seen = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    crc = crc32Update(crc, value);
    seen += value.length;
    onChunk?.(seen);
  }
  return crc;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function bytes(length: number): { view: DataView; array: Uint8Array<ArrayBuffer> } {
  const array = new Uint8Array(new ArrayBuffer(length));
  return { view: new DataView(array.buffer), array };
}

interface WrittenEntry {
  nameBytes: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
}

const U32_MAX = 0xffffffff;

/**
 * Builds a stored (uncompressed) ZIP as a list of `Blob` parts. Add entries in order, then call
 * `finish()`. `zip64Threshold` exists for tests; leave it at the default in the app.
 */
export class ZipBuilder {
  private readonly parts: BlobPart[] = [];
  private readonly entries: WrittenEntry[] = [];
  private offset = 0;
  private readonly encoder = new TextEncoder();

  constructor(
    private readonly now: Date = new Date(),
    private readonly zip64Threshold = U32_MAX,
  ) {}

  /** Add a file whose CRC and size are already known (`blob.size` is used as the size). */
  addBlob(name: string, blob: Blob, crc: number): void {
    const nameBytes = this.encoder.encode(name);
    const { time, date } = dosDateTime(this.now);
    const big = blob.size >= this.zip64Threshold || this.offset >= this.zip64Threshold;
    const extraLength = big ? 20 : 0;
    const { view, array } = bytes(30 + nameBytes.length + extraLength);
    view.setUint32(0, LOCAL_SIG, true);
    view.setUint16(4, big ? 45 : 20, true);
    view.setUint16(6, 0x0800, true); // UTF-8 names
    view.setUint16(8, 0, true); // stored
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, big ? U32_MAX : blob.size, true);
    view.setUint32(22, big ? U32_MAX : blob.size, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, extraLength, true);
    array.set(nameBytes, 30);
    if (big) {
      const x = 30 + nameBytes.length;
      view.setUint16(x, 1, true);
      view.setUint16(x + 2, 16, true);
      view.setBigUint64(x + 4, BigInt(blob.size), true);
      view.setBigUint64(x + 12, BigInt(blob.size), true);
    }
    this.entries.push({ nameBytes, crc, size: blob.size, offset: this.offset, time, date });
    this.parts.push(array, blob);
    this.offset += array.length + blob.size;
  }

  /** Add small in-memory data (JSON, text). */
  addBytes(name: string, data: Uint8Array): void {
    this.addBlob(name, new Blob([data as BlobPart]), crc32Update(0, data));
  }

  /** Write the directory and return the finished archive. */
  finish(): Blob {
    const cdStart = this.offset;
    const cdParts: Uint8Array<ArrayBuffer>[] = [];
    let cdSize = 0;
    for (const e of this.entries) {
      const big = e.size >= this.zip64Threshold || e.offset >= this.zip64Threshold;
      const sizeBig = e.size >= this.zip64Threshold;
      const offsetBig = e.offset >= this.zip64Threshold;
      const extraLength = big ? 4 + (sizeBig ? 16 : 0) + (offsetBig ? 8 : 0) : 0;
      const { view, array } = bytes(46 + e.nameBytes.length + extraLength);
      view.setUint32(0, CENTRAL_SIG, true);
      view.setUint16(4, big ? 45 : 20, true);
      view.setUint16(6, big ? 45 : 20, true);
      view.setUint16(8, 0x0800, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, e.time, true);
      view.setUint16(14, e.date, true);
      view.setUint32(16, e.crc, true);
      view.setUint32(20, sizeBig ? U32_MAX : e.size, true);
      view.setUint32(24, sizeBig ? U32_MAX : e.size, true);
      view.setUint16(28, e.nameBytes.length, true);
      view.setUint16(30, extraLength, true);
      view.setUint32(42, offsetBig ? U32_MAX : e.offset, true);
      array.set(e.nameBytes, 46);
      if (big) {
        let x = 46 + e.nameBytes.length;
        view.setUint16(x, 1, true);
        view.setUint16(x + 2, extraLength - 4, true);
        x += 4;
        if (sizeBig) {
          view.setBigUint64(x, BigInt(e.size), true);
          view.setBigUint64(x + 8, BigInt(e.size), true);
          x += 16;
        }
        if (offsetBig) view.setBigUint64(x, BigInt(e.offset), true);
      }
      cdParts.push(array);
      cdSize += array.length;
    }
    const needs64 = this.entries.length >= 0xffff || cdStart >= this.zip64Threshold || cdSize >= this.zip64Threshold;
    const tail: BlobPart[] = [];
    if (needs64) {
      const e64 = bytes(56);
      e64.view.setUint32(0, EOCD64_SIG, true);
      e64.view.setBigUint64(4, 44n, true);
      e64.view.setUint16(12, 45, true);
      e64.view.setUint16(14, 45, true);
      e64.view.setBigUint64(24, BigInt(this.entries.length), true);
      e64.view.setBigUint64(32, BigInt(this.entries.length), true);
      e64.view.setBigUint64(40, BigInt(cdSize), true);
      e64.view.setBigUint64(48, BigInt(cdStart), true);
      const loc = bytes(20);
      loc.view.setUint32(0, EOCD64_LOCATOR_SIG, true);
      loc.view.setBigUint64(8, BigInt(cdStart + cdSize), true);
      loc.view.setUint32(16, 1, true);
      tail.push(e64.array, loc.array);
    }
    const end = bytes(22);
    end.view.setUint32(0, EOCD_SIG, true);
    end.view.setUint16(8, needs64 ? 0xffff : this.entries.length, true);
    end.view.setUint16(10, needs64 ? 0xffff : this.entries.length, true);
    end.view.setUint32(12, needs64 ? U32_MAX : cdSize, true);
    end.view.setUint32(16, needs64 ? U32_MAX : cdStart, true);
    tail.push(end.array);
    return new Blob([...this.parts, ...cdParts, ...tail] as BlobPart[], { type: 'application/zip' });
  }
}
