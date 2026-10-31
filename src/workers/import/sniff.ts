import type { BookFormat, BookKind } from '@/app/contracts';
import { ascii, decodeText, indexOfAscii, isValidUtf8, readRange, startsWith, u16be, u16le, u32be, u64be } from './bytes';
import type { SniffResult, UnsupportedReason } from './types';
import { findEntry, hasZipSignature, readZipEntries, readZipEntry, ZipError, type ZipEntry } from './zip';

/**
 * Content sniffing: what a file IS, decided from its bytes. The file name, its extension and the
 * browser's MIME type are never looked at, so `book.epub__1_`, a wrong extension and no
 * extension all work. Only the bytes that are needed are read (a 64 KB head, plus a few small
 * reads for ZIP directories and MP4 boxes).
 */

const HEAD_BYTES = 64 * 1024;
const MAX_MOOV_BYTES = 16 * 1024 * 1024;

const ok = (kind: BookKind, format: BookFormat): SniffResult => ({ ok: true, kind, format });
const no = (reason: UnsupportedReason): SniffResult => ({ ok: false, reason });

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|bmp|avif)$/i;

/** Decide what `file` is. Never throws. */
export async function sniffFile(file: Blob): Promise<SniffResult> {
  try {
    return await sniff(file);
  } catch {
    return no('damaged');
  }
}

async function sniff(file: Blob): Promise<SniffResult> {
  if (file.size === 0) return no('empty');
  const head = await readRange(file, 0, HEAD_BYTES);

  // PDF: the header may follow up to 1 KB of junk.
  if (indexOfAscii(head.subarray(0, 1024), '%PDF-') >= 0) return ok('pdf', 'pdf');

  if (hasZipSignature(head)) return sniffZip(file);

  if (startsWith(head, 'AT&TFORM') && (ascii(head, 12, 16) === 'DJVU' || ascii(head, 12, 16) === 'DJVM')) return ok('ebook', 'djvu');
  if (startsWith(head, '{\\rtf')) return ok('doc', 'rtf');

  // Kindle and Mobipocket (PalmDB header, type and creator at offset 60).
  if (ascii(head, 60, 68) === 'BOOKMOBI') return sniffMobi(file, head);
  if (ascii(head, 60, 68) === 'TEXtREAd') return no('unsupported-type');
  if (startsWith(head, 'TPZ')) return no('drm'); // Kindle Topaz, always protected

  const audio = await sniffAudio(file, head);
  if (audio) return audio;

  if (isKnownBinary(head)) return no('unsupported-type');

  return sniffText(head);
}

// ---------------------------------------------------------------------------
// ZIP containers: EPUB, DOCX, CBZ
// ---------------------------------------------------------------------------

const FONT_ENCRYPTION = ['http://www.idpf.org/2008/embedding', 'http://ns.adobe.com/pdf/enc#RC'];

async function sniffZip(file: Blob): Promise<SniffResult> {
  let entries: ZipEntry[];
  try {
    entries = await readZipEntries(file);
  } catch (error) {
    if (error instanceof ZipError) return no('damaged');
    throw error;
  }
  const files = entries.filter((e) => !e.isDirectory);
  if (files.length === 0) return no('empty');
  const has = (name: string): boolean => findEntry(entries, name) !== undefined;

  const mimetype = findEntry(entries, 'mimetype');
  let epub = has('META-INF/container.xml');
  if (mimetype && !mimetype.encrypted && mimetype.size < 256) {
    const text = decodeText(await readZipEntry(file, mimetype, 256)).trim();
    if (text.startsWith('application/epub+zip')) epub = true;
    else if (text.startsWith('application/vnd.oasis.opendocument') || text.startsWith('application/vnd.')) {
      if (!epub) return no('unsupported-type');
    }
  }
  if (epub) {
    if (has('META-INF/rights.xml') || has('META-INF/sinf.xml')) return no('drm');
    const enc = findEntry(entries, 'META-INF/encryption.xml');
    if (enc && !enc.encrypted && enc.size < 1_000_000) {
      const text = decodeText(await readZipEntry(file, enc, 1_000_000));
      for (const m of text.matchAll(/Algorithm\s*=\s*["']([^"']+)["']/g)) {
        if (!FONT_ENCRYPTION.includes(m[1] as string)) return no('drm');
      }
    }
    return ok('ebook', 'epub');
  }

  if (has('[Content_Types].xml')) {
    if (files.some((e) => e.name.startsWith('word/'))) return ok('doc', 'docx');
    return no('unsupported-type'); // spreadsheets, slides and other packages
  }

  const content = files.filter((e) => !/(^|\/)(thumbs\.db|\.ds_store|comicinfo\.xml)$/i.test(e.name) && !e.name.startsWith('__MACOSX/'));
  const images = content.filter((e) => IMAGE_EXTENSIONS.test(e.name));
  if (images.length > 0 && images.length >= content.length * 0.6) {
    const first = images.slice().sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))[0] as ZipEntry;
    try {
      const bytes = await readZipEntry(file, first, 16);
      if (imageType(bytes)) return ok('ebook', 'cbz');
    } catch {
      return no('damaged');
    }
    return no('zip-not-book');
  }

  if (files.length === 1) {
    const only = files[0] as ZipEntry;
    try {
      const bytes = await readZipEntry(file, only, 2048);
      if (indexOfAscii(bytes, '<FictionBook') >= 0) return no('zipped-fb2');
    } catch {
      return no('damaged');
    }
  }
  return no('zip-not-book');
}

/** Image type from magic bytes, or `undefined`. */
export function imageType(b: Uint8Array): 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp' | 'avif' | undefined {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && startsWith(b, 'PNG', 1)) return 'png';
  if (startsWith(b, 'GIF8')) return 'gif';
  if (startsWith(b, 'RIFF') && ascii(b, 8, 12) === 'WEBP') return 'webp';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  if (ascii(b, 4, 8) === 'ftyp' && (ascii(b, 8, 12) === 'avif' || ascii(b, 8, 12) === 'avis')) return 'avif';
  return undefined;
}

// ---------------------------------------------------------------------------
// MOBI and AZW
// ---------------------------------------------------------------------------

async function sniffMobi(file: Blob, head: Uint8Array): Promise<SniffResult> {
  const recordCount = u16be(head, 76);
  if (recordCount < 2) return no('damaged');
  const rec0 = u32be(head, 78);
  if (rec0 + 32 > file.size) return no('damaged');
  const r = await readRange(file, rec0, 192);
  const encryption = u16be(r, 12);
  if (encryption !== 0) return no('drm');
  const hasMobiHeader = ascii(r, 16, 20) === 'MOBI';
  const version = hasMobiHeader ? u32be(r, 36) : 0;
  return ok('ebook', version >= 8 ? 'azw3' : 'mobi');
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

const MPEG_BITRATES: Record<string, readonly number[]> = {
  // [version][layer] tables flattened as `${versionKey}${layer}`; kbps, index 1..14
  '1-1': [32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  '1-2': [32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  '1-3': [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  '2-1': [32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  '2-2': [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  '2-3': [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const MPEG_RATES: Record<string, readonly number[]> = { '1': [44100, 48000, 32000], '2': [22050, 24000, 16000], '2.5': [11025, 12000, 8000] };

/** Length in bytes of the MPEG audio frame starting at `at`, or 0 when there is no valid header. */
export function mpegFrameLength(b: Uint8Array, at: number): number {
  if (b[at] !== 0xff || ((b[at + 1] ?? 0) & 0xe0) !== 0xe0) return 0;
  const versionBits = ((b[at + 1] as number) >> 3) & 3;
  const layerBits = ((b[at + 1] as number) >> 1) & 3;
  const bitrateIdx = (b[at + 2] ?? 0) >> 4;
  const rateIdx = ((b[at + 2] ?? 0) >> 2) & 3;
  if (versionBits === 1 || layerBits === 0 || bitrateIdx === 0 || bitrateIdx === 15 || rateIdx === 3) return 0;
  const version = versionBits === 3 ? '1' : versionBits === 2 ? '2' : '2.5';
  const layer = 4 - layerBits;
  const kbps = MPEG_BITRATES[`${version === '1' ? '1' : '2'}-${layer}`]?.[bitrateIdx - 1];
  const rate = MPEG_RATES[version]?.[rateIdx];
  if (!kbps || !rate) return 0;
  const padding = ((b[at + 2] as number) >> 1) & 1;
  if (layer === 1) return (Math.floor((12 * kbps * 1000) / rate) + padding) * 4;
  const samples = layer === 3 && version !== '1' ? 72 : 144;
  return Math.floor((samples * kbps * 1000) / rate) + padding;
}

/** Length of an ADTS (raw AAC) frame at `at`, or 0. */
export function adtsFrameLength(b: Uint8Array, at: number): number {
  if (b[at] !== 0xff || ((b[at + 1] ?? 0) & 0xf6) !== 0xf0) return 0;
  const length = (((b[at + 3] ?? 0) & 3) << 11) | ((b[at + 4] ?? 0) << 3) | ((b[at + 5] ?? 0) >> 5);
  return length >= 7 ? length : 0;
}

/** Walk `frames` consecutive frames from `at`; true when they chain. */
function chains(b: Uint8Array, at: number, lengthOf: (b: Uint8Array, at: number) => number, frames = 3): boolean {
  let pos = at;
  for (let i = 0; i < frames; i += 1) {
    const length = lengthOf(b, pos);
    if (length === 0) return false;
    pos += length;
    if (pos >= b.length) return i >= 1; // ran off the sample after at least two good frames
  }
  return true;
}

function sniffRawAudio(b: Uint8Array, scan: number): SniffResult | undefined {
  for (let at = 0; at < Math.min(scan, b.length - 4); at += 1) {
    if (b[at] !== 0xff) continue;
    if (adtsFrameLength(b, at) && chains(b, at, adtsFrameLength)) return ok('audio', 'aac');
    if (mpegFrameLength(b, at) && chains(b, at, mpegFrameLength)) return ok('audio', 'mp3');
  }
  return undefined;
}

async function sniffAudio(file: Blob, head: Uint8Array): Promise<SniffResult | undefined> {
  let probe = head;
  let base = 0;
  let tagged = false;
  if (startsWith(head, 'ID3') && head.length >= 10) {
    tagged = true;
    // Skip every ID3v2 tag, then look at what follows.
    for (let guard = 0; guard < 4 && startsWith(probe, 'ID3'); guard += 1) {
      const size = ((probe[6] ?? 0) << 21) | ((probe[7] ?? 0) << 14) | ((probe[8] ?? 0) << 7) | (probe[9] ?? 0);
      base += 10 + size + ((probe[5] ?? 0) & 0x10 ? 10 : 0);
      probe = await readRange(file, base, 8192);
      // Padding after the tag is zeros.
      let z = 0;
      while (z < probe.length && probe[z] === 0) z += 1;
      if (z > 0 && z < probe.length) {
        base += z;
        probe = await readRange(file, base, 8192);
      }
    }
  }
  if (startsWith(probe, 'fLaC')) return ok('audio', 'flac');
  if (startsWith(probe, 'OggS')) return sniffOgg(probe);
  if (startsWith(probe, 'RIFF') && ascii(probe, 8, 12) === 'WAVE') return ok('audio', 'wav');
  if (ascii(probe, 4, 8) === 'ftyp') return sniffMp4(file, base, probe);
  const raw = sniffRawAudio(probe, tagged ? 4096 : 1024);
  if (raw) return raw;
  if (tagged) return no('damaged');
  return undefined;
}

function sniffOgg(page: Uint8Array): SniffResult {
  const text = ascii(page, 0, Math.min(page.length, 200));
  if (text.includes('OpusHead')) return ok('audio', 'opus');
  if (text.includes('vorbis') || text.includes('Speex') || text.includes('FLAC')) return ok('audio', 'ogg');
  if (text.includes('theora') || text.includes('video')) return no('unsupported-type');
  return ok('audio', 'ogg');
}

export interface Mp4Box {
  type: string;
  start: number;
  headerSize: number;
  size: number;
}

export function boxAt(b: Uint8Array, at: number, fileEnd: number): Mp4Box | undefined {
  if (at + 8 > b.length) return undefined;
  let size = u32be(b, at);
  let headerSize = 8;
  if (size === 1) {
    if (at + 16 > b.length) return undefined;
    size = u64be(b, at + 8);
    headerSize = 16;
  } else if (size === 0) {
    size = fileEnd - at;
  }
  if (size < headerSize) return undefined;
  return { type: ascii(b, at + 4, at + 8), start: at, headerSize, size };
}

/** Walk the top-level boxes by their headers only until `moov` is found. Returns `undefined` when it is missing or cut short. */
export async function locateMoov(file: Blob, base = 0): Promise<Mp4Box | undefined> {
  let at = base;
  for (let guard = 0; guard < 4096 && at + 8 <= file.size; guard += 1) {
    const header = await readRange(file, at, 16);
    const box = boxAt(header, 0, file.size - at);
    if (!box) return undefined;
    if (box.type === 'moov') {
      if (box.size > MAX_MOOV_BYTES || at + box.size > file.size) return undefined;
      return { ...box, start: at };
    }
    at += box.size;
  }
  return undefined;
}

export function childBoxes(b: Uint8Array, from: number, to: number): Mp4Box[] {
  const out: Mp4Box[] = [];
  let at = from;
  while (at + 8 <= to) {
    const box = boxAt(b, at, to);
    if (!box || at + box.size > to + 0) {
      if (box) out.push({ ...box, size: to - at });
      break;
    }
    out.push(box);
    at += box.size;
  }
  return out;
}

interface Mp4Facts {
  audio: boolean;
  video: boolean;
  protectedAudio: boolean;
  chapters: boolean;
}

function readMoov(b: Uint8Array, from: number, to: number): Mp4Facts {
  const facts: Mp4Facts = { audio: false, video: false, protectedAudio: false, chapters: false };
  for (const trak of childBoxes(b, from, to).filter((x) => x.type === 'trak')) {
    const mdia = childBoxes(b, trak.start + trak.headerSize, trak.start + trak.size).find((x) => x.type === 'mdia');
    if (!mdia) continue;
    const mdiaKids = childBoxes(b, mdia.start + mdia.headerSize, mdia.start + mdia.size);
    const hdlr = mdiaKids.find((x) => x.type === 'hdlr');
    const handler = hdlr ? ascii(b, hdlr.start + hdlr.headerSize + 8, hdlr.start + hdlr.headerSize + 12) : '';
    if (handler === 'vide') facts.video = true;
    if (handler === 'text' || handler === 'sbtl') facts.chapters = true;
    if (handler !== 'soun') continue;
    facts.audio = true;
    const minf = mdiaKids.find((x) => x.type === 'minf');
    const stbl = minf ? childBoxes(b, minf.start + minf.headerSize, minf.start + minf.size).find((x) => x.type === 'stbl') : undefined;
    const stsd = stbl ? childBoxes(b, stbl.start + stbl.headerSize, stbl.start + stbl.size).find((x) => x.type === 'stsd') : undefined;
    if (stsd) {
      const entry = ascii(b, stsd.start + stsd.headerSize + 12, stsd.start + stsd.headerSize + 16);
      if (['drms', 'enca', 'aavd', 'drmi'].includes(entry)) facts.protectedAudio = true;
    }
  }
  const udta = childBoxes(b, from, to).find((x) => x.type === 'udta');
  if (udta && childBoxes(b, udta.start + udta.headerSize, udta.start + udta.size).some((x) => x.type === 'chpl')) facts.chapters = true;
  return facts;
}

async function sniffMp4(file: Blob, base: number, probe: Uint8Array): Promise<SniffResult> {
  const major = ascii(probe, 8, 12);
  const ftypSize = u32be(probe, 0);
  const brands = new Set<string>([major]);
  for (let at = 16; at + 4 <= Math.min(ftypSize, probe.length); at += 4) brands.add(ascii(probe, at, at + 4));
  if (brands.has('M4P ') || brands.has('aax ') || brands.has('aaxc')) return no('drm');
  if (brands.has('qt  ') || brands.has('heic') || brands.has('mif1') || brands.has('avif') || brands.has('crx ')) return no('unsupported-type');

  const moov = await locateMoov(file, base);
  if (!moov) return no('damaged');
  const bytes = await readRange(file, moov.start, moov.size);
  const facts = readMoov(bytes, moov.headerSize, bytes.length);
  if (facts.protectedAudio) return no('drm');
  if (facts.video || !facts.audio) return no('unsupported-type');
  const format: BookFormat = major === 'M4B ' || brands.has('M4B ') || facts.chapters ? 'm4b' : 'm4a';
  return ok('audio', format);
}

// ---------------------------------------------------------------------------
// Text, FB2, HTML
// ---------------------------------------------------------------------------

/** Leading bytes of common non-book binaries, so they get the right plain-words message. */
function isKnownBinary(b: Uint8Array): boolean {
  return (
    imageType(b) !== undefined ||
    startsWith(b, 'RIFF') ||
    startsWith(b, 'FORM') ||
    (b[0] === 0x30 && b[1] === 0x26 && b[2] === 0xb2 && b[3] === 0x75) || // ASF / WMA
    startsWith(b, '#!AMR') ||
    startsWith(b, 'MZ') ||
    startsWith(b, '\x7fELF') ||
    startsWith(b, 'Rar!') ||
    startsWith(b, '7z\xbc\xaf') ||
    (b[0] === 0x1f && b[1] === 0x8b) ||
    startsWith(b, 'SQLite format') ||
    startsWith(b, 'wvpk') ||
    startsWith(b, 'MAC ') ||
    (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) // Matroska / WebM
  );
}

function hasBinaryControls(b: Uint8Array): boolean {
  for (const c of b) {
    if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0c && c !== 0x0d && c !== 0x1b) return true;
    if (c === 0x7f) return true;
  }
  return false;
}

function sniffText(head: Uint8Array): SniffResult {
  let text: string | undefined;
  if (head[0] === 0xff && head[1] === 0xfe) text = utf16(head.subarray(2), true);
  else if (head[0] === 0xfe && head[1] === 0xff) text = utf16(head.subarray(2), false);
  else if (head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) {
    if (hasBinaryControls(head.subarray(3))) return no('unsupported-type');
    text = decodeText(head.subarray(3));
  } else {
    if (hasBinaryControls(head)) return no('unsupported-type');
    // Valid UTF-8 or a legacy 8-bit encoding (Windows-1251 and friends): both are plain text.
    text = isValidUtf8(head) ? decodeText(head) : ascii(head, 0, head.length);
  }
  // eslint-disable-next-line no-control-regex -- detecting binary control bytes is the point
  if (text === undefined || /[\u0000-\u0008\u000e-\u001a\u001c-\u001f]/.test(text)) return no('unsupported-type');

  const lead = text.replace(/^\ufeff/, '').trimStart().slice(0, 4096);
  if (/^<\?xml/i.test(lead) || /^<FictionBook/i.test(lead) || lead.slice(0, 4096).includes('<FictionBook')) {
    return lead.includes('<FictionBook') ? ok('ebook', 'fb2') : no('unsupported-type');
  }
  if (/^<!doctype\s+html|^<html[\s>]|^<head[\s>]/i.test(lead)) return ok('doc', 'html');
  return ok('doc', 'txt');
}

function utf16(b: Uint8Array, little: boolean): string | undefined {
  const even = b.subarray(0, b.length - (b.length % 2));
  if (even.length === 0) return '';
  const unit = (i: number): number => (little ? u16le(even, i) : u16be(even, i));
  let text = '';
  for (let i = 0; i < even.length; i += 2) {
    const c = unit(i);
    if (c === 0 || (c < 0x20 && c !== 9 && c !== 10 && c !== 12 && c !== 13 && c !== 27)) return undefined;
    text += String.fromCharCode(c);
  }
  return text;
}
