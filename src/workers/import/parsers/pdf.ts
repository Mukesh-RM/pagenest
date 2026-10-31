import { ascii, indexOfAscii, readRange, readStream } from '../bytes';
import { cleanText, type ParsedMeta } from '../types';

/**
 * PDF title, author and page count without loading pdf.js (which is far too big for the import
 * worker). It follows the file's own cross-reference data: classic tables, cross-reference
 * streams and compressed object streams. Anything unexpected ends in the fallback: a scan of
 * the last megabyte for the Info strings. It never throws and never reads the whole file.
 */

type PdfValue = number | string | PdfName | PdfRef | PdfDict | PdfValue[] | boolean | null;
class PdfName {
  constructor(readonly name: string) {}
}
class PdfRef {
  constructor(readonly num: number) {}
}
type PdfDict = Map<string, PdfValue>;

type XrefEntry = { type: 1; offset: number } | { type: 2; stream: number; index: number };

const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set('()<>[]{}/%'.split('').map((c) => c.charCodeAt(0)));

class Lexer {
  pos = 0;
  constructor(readonly b: Uint8Array) {}

  skip(): void {
    for (;;) {
      const c = this.b[this.pos];
      if (c === undefined) return;
      if (WS.has(c)) this.pos += 1;
      else if (c === 0x25) {
        while (this.pos < this.b.length && this.b[this.pos] !== 10 && this.b[this.pos] !== 13) this.pos += 1;
      } else return;
    }
  }

  value(depth = 0): PdfValue | undefined {
    if (depth > 24) return undefined;
    this.skip();
    const c = this.b[this.pos];
    if (c === undefined) return undefined;
    if (c === 0x2f) return this.name();
    if (c === 0x28) return this.literal();
    if (c === 0x3c) {
      if (this.b[this.pos + 1] === 0x3c) return this.dict(depth);
      return this.hex();
    }
    if (c === 0x5b) {
      this.pos += 1;
      const arr: PdfValue[] = [];
      for (;;) {
        this.skip();
        if (this.b[this.pos] === 0x5d) {
          this.pos += 1;
          return arr;
        }
        const v = this.value(depth + 1);
        if (v === undefined) return arr;
        arr.push(v);
      }
    }
    return this.atom();
  }

  dict(depth: number): PdfDict {
    this.pos += 2;
    const d: PdfDict = new Map();
    for (;;) {
      this.skip();
      if (this.b[this.pos] === 0x3e && this.b[this.pos + 1] === 0x3e) {
        this.pos += 2;
        return d;
      }
      const key = this.value(depth + 1);
      if (!(key instanceof PdfName)) return d;
      const v = this.value(depth + 1);
      if (v === undefined) return d;
      d.set(key.name, v);
    }
  }

  name(): PdfName {
    this.pos += 1;
    let s = '';
    while (this.pos < this.b.length) {
      const c = this.b[this.pos] as number;
      if (WS.has(c) || DELIM.has(c)) break;
      if (c === 0x23) {
        const hex = ascii(this.b, this.pos + 1, this.pos + 3);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          s += String.fromCharCode(parseInt(hex, 16));
          this.pos += 3;
          continue;
        }
      }
      s += String.fromCharCode(c);
      this.pos += 1;
    }
    return new PdfName(s);
  }

  literal(): string {
    this.pos += 1;
    let depth = 1;
    let s = '';
    while (this.pos < this.b.length) {
      const c = this.b[this.pos] as number;
      this.pos += 1;
      if (c === 0x5c) {
        const n = this.b[this.pos] as number;
        this.pos += 1;
        if (n === 0x6e) s += '\n';
        else if (n === 0x72) s += '\r';
        else if (n === 0x74) s += '\t';
        else if (n === 0x62) s += '\b';
        else if (n === 0x66) s += '\f';
        else if (n >= 0x30 && n <= 0x37) {
          let oct = String.fromCharCode(n);
          for (let i = 0; i < 2; i += 1) {
            const d = this.b[this.pos];
            if (d !== undefined && d >= 0x30 && d <= 0x37) {
              oct += String.fromCharCode(d);
              this.pos += 1;
            }
          }
          s += String.fromCharCode(parseInt(oct, 8) & 0xff);
        } else if (n === 13) {
          if (this.b[this.pos] === 10) this.pos += 1;
        } else if (n !== 10) s += String.fromCharCode(n);
      } else if (c === 0x28) {
        depth += 1;
        s += '(';
      } else if (c === 0x29) {
        depth -= 1;
        if (depth === 0) return s;
        s += ')';
      } else s += String.fromCharCode(c);
    }
    return s;
  }

  hex(): string {
    this.pos += 1;
    let h = '';
    while (this.pos < this.b.length && this.b[this.pos] !== 0x3e) {
      const c = String.fromCharCode(this.b[this.pos] as number);
      if (/[0-9a-fA-F]/.test(c)) h += c;
      this.pos += 1;
    }
    this.pos += 1;
    if (h.length % 2) h += '0';
    let s = '';
    for (let i = 0; i < h.length; i += 2) s += String.fromCharCode(parseInt(h.slice(i, i + 2), 16));
    return s;
  }

  atom(): PdfValue | undefined {
    this.skip();
    const start = this.pos;
    while (this.pos < this.b.length) {
      const c = this.b[this.pos] as number;
      if (WS.has(c) || DELIM.has(c)) break;
      this.pos += 1;
    }
    if (this.pos === start) {
      this.pos += 1;
      return undefined;
    }
    const word = ascii(this.b, start, this.pos);
    if (word === 'true') return true;
    if (word === 'false') return false;
    if (word === 'null') return null;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) {
      const n = Number(word);
      if (/^\d+$/.test(word)) {
        // `12 0 R` is a reference.
        const save = this.pos;
        this.skip();
        const gen = this.atomWord();
        if (gen !== undefined && /^\d+$/.test(gen)) {
          this.skip();
          if (this.b[this.pos] === 0x52 && (WS.has(this.b[this.pos + 1] ?? 32) || DELIM.has(this.b[this.pos + 1] ?? 0x20) || this.pos + 1 >= this.b.length)) {
            this.pos += 1;
            return new PdfRef(n);
          }
        }
        this.pos = save;
      }
      return n;
    }
    return word;
  }

  private atomWord(): string | undefined {
    const start = this.pos;
    while (this.pos < this.b.length) {
      const c = this.b[this.pos] as number;
      if (WS.has(c) || DELIM.has(c)) break;
      this.pos += 1;
    }
    return this.pos === start ? undefined : ascii(this.b, start, this.pos);
  }
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate')) as ReadableStream<Uint8Array>;
  return readStream(stream, 64 * 1024 * 1024);
}

function unpredict(data: Uint8Array, params: PdfDict | undefined): Uint8Array {
  const predictor = Number(params?.get('Predictor') ?? 1);
  if (predictor < 10) return data;
  const columns = Number(params?.get('Columns') ?? 1);
  const colors = Number(params?.get('Colors') ?? 1);
  const bpc = Number(params?.get('BitsPerComponent') ?? 8);
  const rowBytes = Math.ceil((columns * colors * bpc) / 8);
  const bpp = Math.max(1, Math.ceil((colors * bpc) / 8));
  const rows = Math.floor(data.length / (rowBytes + 1));
  const out = new Uint8Array(rows * rowBytes);
  for (let r = 0; r < rows; r += 1) {
    const type = data[r * (rowBytes + 1)] as number;
    for (let i = 0; i < rowBytes; i += 1) {
      const x = data[r * (rowBytes + 1) + 1 + i] as number;
      const left = i >= bpp ? (out[r * rowBytes + i - bpp] as number) : 0;
      const up = r > 0 ? (out[(r - 1) * rowBytes + i] as number) : 0;
      const upLeft = r > 0 && i >= bpp ? (out[(r - 1) * rowBytes + i - bpp] as number) : 0;
      let v = x;
      if (type === 1) v = x + left;
      else if (type === 2) v = x + up;
      else if (type === 3) v = x + Math.floor((left + up) / 2);
      else if (type === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        v = x + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
      }
      out[r * rowBytes + i] = v & 0xff;
    }
  }
  return out;
}

class PdfReader {
  private readonly xref = new Map<number, XrefEntry>();
  trailer: PdfDict | undefined;
  private readonly objStreams = new Map<number, { nums: number[]; offsets: number[]; data: Uint8Array; first: number }>();

  constructor(private readonly file: Blob) {}

  async load(): Promise<boolean> {
    const tail = await readRange(this.file, this.file.size - 2048, 2048);
    const at = lastIndexOfAscii(tail, 'startxref');
    if (at < 0) return false;
    const start = Number(/\d+/.exec(ascii(tail, at + 9, at + 40))?.[0]);
    if (!Number.isFinite(start)) return false;
    const seen = new Set<number>();
    let next: number | undefined = start;
    while (next !== undefined && !seen.has(next) && seen.size < 64 && next < this.file.size) {
      seen.add(next);
      const section = await this.section(next);
      if (!section) break;
      this.trailer ??= section;
      const xrefStm = section.get('XRefStm');
      if (typeof xrefStm === 'number' && !seen.has(xrefStm)) {
        seen.add(xrefStm);
        await this.section(xrefStm);
      }
      const prev = section.get('Prev');
      next = typeof prev === 'number' ? prev : undefined;
    }
    return this.trailer !== undefined;
  }

  private async section(offset: number): Promise<PdfDict | undefined> {
    const chunk = await readRange(this.file, offset, 4 * 1024 * 1024);
    const lex = new Lexer(chunk);
    lex.skip();
    if (ascii(chunk, lex.pos, lex.pos + 4) === 'xref') {
      lex.pos += 4;
      for (;;) {
        lex.skip();
        if (ascii(chunk, lex.pos, lex.pos + 7) === 'trailer') {
          lex.pos += 7;
          const d = lex.value();
          return d instanceof Map ? d : undefined;
        }
        const first = lex.atom();
        const count = lex.atom();
        if (typeof first !== 'number' || typeof count !== 'number') return undefined;
        for (let i = 0; i < count; i += 1) {
          lex.skip();
          const off = lex.atom();
          const gen = lex.atom();
          lex.skip();
          const flag = String.fromCharCode(chunk[lex.pos] ?? 0);
          lex.pos += 1;
          if (typeof off !== 'number' || typeof gen !== 'number') return undefined;
          if (flag === 'n' && !this.xref.has(first + i)) this.xref.set(first + i, { type: 1, offset: off });
        }
      }
    }
    // Cross-reference stream: `N G obj << ... >> stream`.
    const obj = await this.parseObjectAt(chunk, lex.pos);
    if (!obj || !(obj.dict instanceof Map) || !obj.stream) return undefined;
    const dict = obj.dict;
    if ((dict.get('Type') as PdfName | undefined)?.name !== 'XRef') return undefined;
    const data = await this.decodeStream(dict, obj.stream);
    const w = (dict.get('W') as number[] | undefined) ?? [];
    const size = Number(dict.get('Size') ?? 0);
    const index = (dict.get('Index') as number[] | undefined) ?? [0, size];
    const [w0 = 0, w1 = 0, w2 = 0] = w;
    const rowLength = w0 + w1 + w2;
    if (rowLength === 0) return undefined;
    const field = (row: number, from: number, len: number): number => {
      let v = 0;
      for (let i = 0; i < len; i += 1) v = v * 256 + (data[row * rowLength + from + i] as number);
      return v;
    };
    let row = 0;
    for (let s = 0; s + 1 < index.length; s += 2) {
      for (let i = 0; i < (index[s + 1] as number); i += 1, row += 1) {
        if ((row + 1) * rowLength > data.length) break;
        const type = w0 === 0 ? 1 : field(row, 0, w0);
        const num = (index[s] as number) + i;
        if (this.xref.has(num)) continue;
        if (type === 1) this.xref.set(num, { type: 1, offset: field(row, w0, w1) });
        else if (type === 2) this.xref.set(num, { type: 2, stream: field(row, w0, w1), index: field(row, w0 + w1, w2) });
      }
    }
    return dict;
  }

  private async parseObjectAt(chunk: Uint8Array, at: number): Promise<{ dict: PdfValue; stream?: Uint8Array } | undefined> {
    const lex = new Lexer(chunk);
    lex.pos = at;
    const num = lex.atom();
    const gen = lex.atom();
    lex.skip();
    if (typeof num !== 'number' || typeof gen !== 'number' || ascii(chunk, lex.pos, lex.pos + 3) !== 'obj') return undefined;
    lex.pos += 3;
    const dict = lex.value();
    if (dict === undefined) return undefined;
    lex.skip();
    if (dict instanceof Map && ascii(chunk, lex.pos, lex.pos + 6) === 'stream') {
      let p = lex.pos + 6;
      if (chunk[p] === 13) p += 1;
      if (chunk[p] === 10) p += 1;
      let length = dict.get('Length');
      if (length instanceof PdfRef) length = (await this.resolve(length)) as number;
      let end: number;
      if (typeof length === 'number' && length >= 0) end = p + length;
      else end = indexOfAscii(chunk, 'endstream', p);
      if (end < 0 || end > chunk.length) return { dict };
      return { dict, stream: chunk.subarray(p, end) };
    }
    return { dict };
  }

  private async decodeStream(dict: PdfDict, raw: Uint8Array): Promise<Uint8Array> {
    let filter = dict.get('Filter');
    let params = dict.get('DecodeParms');
    if (Array.isArray(filter)) {
      if (filter.length !== 1) throw new Error('unsupported filter chain');
      filter = filter[0];
      if (Array.isArray(params)) params = params[0];
    }
    if (filter === undefined) return raw;
    if (!(filter instanceof PdfName) || (filter.name !== 'FlateDecode' && filter.name !== 'Fl')) throw new Error('unsupported filter');
    return unpredict(await inflate(raw), params instanceof Map ? params : undefined);
  }

  async resolve(value: PdfValue | undefined): Promise<PdfValue | undefined> {
    let v = value;
    for (let guard = 0; guard < 8 && v instanceof PdfRef; guard += 1) v = await this.object(v.num);
    return v;
  }

  async object(num: number): Promise<PdfValue | undefined> {
    const entry = this.xref.get(num);
    if (!entry) return undefined;
    if (entry.type === 1) {
      const chunk = await readRange(this.file, entry.offset, 256 * 1024);
      return (await this.parseObjectAt(chunk, 0))?.dict;
    }
    let os = this.objStreams.get(entry.stream);
    if (!os) {
      const e = this.xref.get(entry.stream);
      if (!e || e.type !== 1) return undefined;
      const chunk = await readRange(this.file, e.offset, 16 * 1024 * 1024);
      const obj = await this.parseObjectAt(chunk, 0);
      if (!obj || !(obj.dict instanceof Map) || !obj.stream) return undefined;
      const data = await this.decodeStream(obj.dict, obj.stream);
      const n = Number(obj.dict.get('N') ?? 0);
      const first = Number(obj.dict.get('First') ?? 0);
      const lex = new Lexer(data);
      const nums: number[] = [];
      const offsets: number[] = [];
      for (let i = 0; i < n; i += 1) {
        nums.push(Number(lex.atom()));
        offsets.push(Number(lex.atom()));
      }
      os = { nums, offsets, data, first };
      this.objStreams.set(entry.stream, os);
    }
    const offset = os.offsets[entry.index];
    if (offset === undefined) return undefined;
    const lex = new Lexer(os.data);
    lex.pos = os.first + offset;
    return lex.value();
  }
}

function lastIndexOfAscii(b: Uint8Array, needle: string): number {
  let found = -1;
  for (let at = indexOfAscii(b, needle); at >= 0; at = indexOfAscii(b, needle, at + 1)) found = at;
  return found;
}

/** Decode a PDF text string: UTF-16BE or UTF-8 with a byte order mark, otherwise PDFDocEncoding (about Latin-1). */
export function decodePdfText(s: string): string {
  if (s.charCodeAt(0) === 0xfe && s.charCodeAt(1) === 0xff) {
    let out = '';
    for (let i = 2; i + 1 < s.length; i += 2) out += String.fromCharCode((s.charCodeAt(i) << 8) | s.charCodeAt(i + 1));
    return out;
  }
  if (s.charCodeAt(0) === 0xef && s.charCodeAt(1) === 0xbb && s.charCodeAt(2) === 0xbf) {
    const bytes = Uint8Array.from(s.slice(3), (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  }
  return s;
}

async function countPages(reader: PdfReader, trailer: PdfDict): Promise<number | undefined> {
  const root = await reader.resolve(trailer.get('Root'));
  if (!(root instanceof Map)) return undefined;
  const pages = await reader.resolve(root.get('Pages'));
  if (!(pages instanceof Map)) return undefined;
  const count = await reader.resolve(pages.get('Count'));
  return typeof count === 'number' && count >= 0 && count < 1e7 ? Math.floor(count) : undefined;
}

/** Title, author and page count. Returns what could be read; `{}` for an unreadable file. */
export async function parsePdf(file: Blob): Promise<ParsedMeta> {
  const out: ParsedMeta = {};
  try {
    const reader = new PdfReader(file);
    if (await reader.load()) {
      const trailer = reader.trailer as PdfDict;
      const encrypted = trailer.has('Encrypt');
      const info = await reader.resolve(trailer.get('Info'));
      if (info instanceof Map && !encrypted) {
        const title = info.get('Title');
        const author = info.get('Author');
        if (typeof title === 'string') {
          const t = cleanText(decodePdfText(title));
          if (t) out.title = t;
        }
        if (typeof author === 'string') {
          const a = cleanText(decodePdfText(author));
          if (a) out.author = a;
        }
      }
      const pages = await countPages(reader, trailer).catch(() => undefined);
      if (pages !== undefined) out.pages = pages;
    }
  } catch {
    /* fall through to the scan */
  }
  if (out.title === undefined || out.pages === undefined) await scanTail(file, out);
  return out;
}

/** Last resort: look for `/Title (...)` and `/Count n` in the last megabyte. */
async function scanTail(file: Blob, out: ParsedMeta): Promise<void> {
  const tail = await readRange(file, file.size - 1024 * 1024, 1024 * 1024);
  const text = ascii(tail, 0, tail.length);
  if (out.title === undefined && !/\/Encrypt\b/.test(text)) {
    const m = /\/Title\s*(\((?:\\.|[^\\)])*\)|<[0-9a-fA-F\s]*>)/.exec(text);
    if (m) {
      const lex = new Lexer(Uint8Array.from(m[1] as string, (c) => c.charCodeAt(0)));
      const v = lex.value();
      if (typeof v === 'string') {
        const t = cleanText(decodePdfText(v));
        if (t) out.title = t;
      }
    }
  }
  if (out.pages === undefined) {
    const counts = [...text.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g)].map((m) => Number(m[1] ?? m[2]));
    const best = Math.max(0, ...counts);
    if (best > 0) out.pages = best;
  }
}
