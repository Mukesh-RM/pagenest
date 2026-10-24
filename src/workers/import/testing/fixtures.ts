import { crc32Update } from '../zip';

/**
 * Builders for small, valid sample files of every supported format. Used by the Vitest and
 * Playwright tests (never shipped: nothing imports this from app code). Written independently of
 * the readers, so the tests check the parsers against the file formats, not against themselves.
 */

const enc = new TextEncoder();
export const bytesOf = (s: string): Uint8Array => enc.encode(s);

export function concat(...parts: (Uint8Array | number[])[]): Uint8Array<ArrayBuffer> {
  const arrays = parts.map((p) => (p instanceof Uint8Array ? p : Uint8Array.from(p)));
  const out = new Uint8Array(new ArrayBuffer(arrays.reduce((n, a) => n + a.length, 0)));
  let at = 0;
  for (const a of arrays) {
    out.set(a, at);
    at += a.length;
  }
  return out;
}

const be32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const be16 = (n: number): number[] => [(n >>> 8) & 255, n & 255];
const le32 = (n: number): number[] => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const le16 = (n: number): number[] => [n & 255, (n >>> 8) & 255];
const asc = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

async function deflate(data: Uint8Array, format: 'deflate' | 'deflate-raw'): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ---------------------------------------------------------------------------
// ZIP
// ---------------------------------------------------------------------------

export interface ZipFile {
  name: string;
  data: Uint8Array | string;
  /** Deflate this entry (default: stored). */
  deflate?: boolean;
}

/** A ZIP with stored or deflated entries, written byte by byte. */
export async function makeZip(files: ZipFile[]): Promise<Uint8Array<ArrayBuffer>> {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const raw = typeof f.data === 'string' ? bytesOf(f.data) : f.data;
    const method = f.deflate ? 8 : 0;
    const body = f.deflate ? await deflate(raw, 'deflate-raw') : raw;
    const name = bytesOf(f.name);
    const crc = crc32Update(0, raw);
    const local = concat(le32(0x04034b50), le16(20), le16(0x0800), le16(method), le16(0), le16(0x21), le32(crc), le32(body.length), le32(raw.length), le16(name.length), le16(0), name);
    central.push(concat(le32(0x02014b50), le16(20), le16(20), le16(0x0800), le16(method), le16(0), le16(0x21), le32(crc), le32(body.length), le32(raw.length), le16(name.length), le16(0), le16(0), le16(0), le16(0), le32(0), le32(offset), name));
    parts.push(local, body);
    offset += local.length + body.length;
  }
  const cd = concat(...central);
  return concat(...parts, cd, le32(0x06054b50), le16(0), le16(0), le16(files.length), le16(files.length), le32(cd.length), le32(offset), le16(0));
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/** A real PNG of one flat color. */
export async function makePng(width = 8, height = 12, rgb: [number, number, number] = [200, 80, 60]): Promise<Uint8Array<ArrayBuffer>> {
  const row = [0, ...Array.from({ length: width }, () => rgb).flat()];
  const raw = Uint8Array.from(Array.from({ length: height }, () => row).flat());
  const idat = await deflate(raw, 'deflate');
  const chunk = (type: string, data: Uint8Array | number[]): Uint8Array => {
    const body = concat(asc(type), data);
    return concat(be32(data.length), body, be32(crc32Update(0, body)));
  };
  return concat([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], chunk('IHDR', [...be32(width), ...be32(height), 8, 2, 0, 0, 0]), chunk('IDAT', idat), chunk('IEND', []));
}

/** Not a decodable picture, but starts with the JPEG signature (enough for content sniffing). */
export const jpegStub = (): Uint8Array<ArrayBuffer> => concat([0xff, 0xd8, 0xff, 0xe0, 0, 16], asc('JFIF'), [0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);

// ---------------------------------------------------------------------------
// E-books
// ---------------------------------------------------------------------------

export interface EpubOptions {
  title?: string;
  author?: string;
  language?: string;
  series?: string;
  cover?: Uint8Array;
  /** Skip the `mimetype` entry (only META-INF/container.xml identifies it). */
  noMimetype?: boolean;
  /** Add Adobe DRM rights. */
  drm?: boolean;
  /** Add font obfuscation only (not DRM). */
  fontObfuscation?: boolean;
  /** Extra text added to the chapter so files differ. */
  salt?: string;
}

export async function makeEpub(o: EpubOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
  const title = o.title ?? 'The Sample Epub';
  const files: ZipFile[] = [];
  if (!o.noMimetype) files.push({ name: 'mimetype', data: 'application/epub+zip' });
  files.push({
    name: 'META-INF/container.xml',
    data: '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    deflate: true,
  });
  const meta = [
    `<dc:title>${title}</dc:title>`,
    o.author ? `<dc:creator opf:role="aut">${o.author}</dc:creator>` : '',
    `<dc:language>${o.language ?? 'en'}</dc:language>`,
    o.series ? `<meta name="calibre:series" content="${o.series}"/>` : '',
    o.cover ? '<meta name="cover" content="cover-img"/>' : '',
  ].join('');
  files.push({
    name: 'OEBPS/content.opf',
    data: `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">${meta}</metadata><manifest><item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/>${o.cover ? '<item id="cover-img" href="images/My%20Cover.png" media-type="image/png"/>' : ''}</manifest><spine><itemref idref="c1"/></spine></package>`,
    deflate: true,
  });
  files.push({ name: 'OEBPS/ch1.xhtml', data: `<html><body><p>Chapter one. ${o.salt ?? ''}</p></body></html>`, deflate: true });
  if (o.cover) files.push({ name: 'OEBPS/images/My Cover.png', data: o.cover });
  if (o.drm) files.push({ name: 'META-INF/rights.xml', data: '<rights xmlns="http://ns.adobe.com/adept"/>' });
  if (o.fontObfuscation) {
    files.push({ name: 'META-INF/encryption.xml', data: '<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><EncryptedData xmlns="http://www.w3.org/2001/04/xmlenc#"><EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/></EncryptedData></encryption>' });
  }
  return makeZip(files);
}

export async function makeDocx(o: { title?: string; author?: string; salt?: string } = {}): Promise<Uint8Array<ArrayBuffer>> {
  return makeZip([
    { name: '[Content_Types].xml', data: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>', deflate: true },
    { name: '_rels/.rels', data: '<Relationships/>' },
    { name: 'word/document.xml', data: `<w:document><w:body><w:p>${o.salt ?? 'Hello'}</w:p></w:body></w:document>`, deflate: true },
    { name: 'docProps/core.xml', data: `<cp:coreProperties xmlns:cp="x" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${o.title ?? 'A Document'}</dc:title><dc:creator>${o.author ?? 'Dana Writer'}</dc:creator></cp:coreProperties>`, deflate: true },
  ]);
}

export async function makeCbz(o: { pages?: number; comicInfo?: string; withCover?: boolean; salt?: number } = {}): Promise<Uint8Array<ArrayBuffer>> {
  const pages = o.pages ?? 3;
  const files: ZipFile[] = [];
  for (let i = pages; i >= 1; i -= 1) {
    files.push({ name: `page ${String(i).padStart(3, '0')}.png`, data: await makePng(4, 6, [(i * 40 + (o.salt ?? 0)) % 256, 100, 100]) });
  }
  if (o.comicInfo) files.push({ name: 'ComicInfo.xml', data: o.comicInfo });
  return makeZip(files);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/** Classic PDF with an xref table. */
export function makePdf(o: { title?: string; author?: string; pages?: number; salt?: string } = {}): Uint8Array<ArrayBuffer> {
  const pages = o.pages ?? 3;
  const objs: string[] = [];
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');
  objs.push(`<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${3 + i} 0 R`).join(' ')}] /Count ${pages} >>`);
  for (let i = 0; i < pages; i += 1) objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] >>');
  const infoNum = objs.length + 1;
  objs.push(`<< /Title (${o.title ?? 'A \\(Tiny\\) PDF'}) /Author (${o.author ?? 'Pat Printer'}) /Producer (${o.salt ?? 'tests'}) >>`);
  let out = '%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n';
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o2) => `${String(o2).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${infoNum} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(out, (c) => c.charCodeAt(0) & 255);
}

/** PDF 1.5 with an object stream and a cross-reference stream (PNG predictor), the layout most modern tools write. */
export async function makePdfCompressed(o: { title?: string; author?: string; pages?: number } = {}): Promise<Uint8Array<ArrayBuffer>> {
  const pages = o.pages ?? 5;
  // Objects 1 (catalog), 2 (pages), 3 (info) live in object stream 4; the xref stream is object 5.
  const inner = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [] /Count ${pages} >>`,
    `<< /Title <FEFF${[...(o.title ?? 'Compressed Ünicode')].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}> /Author (${o.author ?? 'Cleo Compressor'}) >>`,
  ];
  let header = '';
  let body = '';
  inner.forEach((s, i) => {
    header += `${i + 1} ${body.length} `;
    body += `${s}\n`;
  });
  const stmData = await deflate(bytesOf(header + body), 'deflate');
  let out: Uint8Array<ArrayBuffer> = concat(bytesOf('%PDF-1.5\n'));
  const obj4Offset = out.length;
  out = concat(out, bytesOf(`4 0 obj\n<< /Type /ObjStm /N 3 /First ${header.length} /Length ${stmData.length} /Filter /FlateDecode >>\nstream\n`), stmData, bytesOf('\nendstream\nendobj\n'));
  const obj5Offset = out.length;
  // Rows: type(1) field2(2) field3(1); objects 0..5.
  const rows: number[][] = [
    [0, 0, 0, 0],
    [2, 0, 4, 0],
    [2, 0, 4, 1],
    [2, 0, 4, 2],
    [1, ...be16(obj4Offset), 0],
    [1, ...be16(obj5Offset), 0],
  ];
  // PNG "Up" predictor (type 2) on every row.
  const filtered: number[] = [];
  rows.forEach((row, r) => {
    filtered.push(2);
    row.forEach((v, i) => filtered.push((v - (r > 0 ? (rows[r - 1] as number[])[i] as number : 0) + 256) & 255));
  });
  const xrefData = await deflate(Uint8Array.from(filtered), 'deflate');
  out = concat(
    out,
    bytesOf(`5 0 obj\n<< /Type /XRef /Size 6 /W [1 2 1] /Root 1 0 R /Info 3 0 R /Length ${xrefData.length} /Filter /FlateDecode /DecodeParms << /Predictor 12 /Columns 4 >> >>\nstream\n`),
    xrefData,
    bytesOf(`\nendstream\nendobj\nstartxref\n${obj5Offset}\n%%EOF\n`),
  );
  return out;
}

// ---------------------------------------------------------------------------
// MOBI / AZW3 / FB2 / text
// ---------------------------------------------------------------------------

export function makeMobi(o: { title?: string; author?: string; version?: number; encryption?: number; cover?: Uint8Array } = {}): Uint8Array<ArrayBuffer> {
  const title = bytesOf(o.title ?? 'Mobi Sample');
  const exth: number[] = [];
  const rec = (type: number, data: Uint8Array | number[]): void => {
    exth.push(...be32(type), ...be32(8 + data.length), ...data);
  };
  let count = 0;
  if (o.author ?? true) {
    rec(100, bytesOf(o.author ?? 'Mia Mobi'));
    count += 1;
  }
  rec(524, bytesOf('en'));
  count += 1;
  if (o.cover) {
    rec(201, be32(0));
    count += 1;
  }
  const exthBlock = concat(asc('EXTH'), be32(12 + exth.length + ((4 - ((12 + exth.length) % 4)) % 4)), be32(count), exth, new Array((4 - ((12 + exth.length) % 4)) % 4).fill(0));
  const headerLength = 232;
  const mobi = new Uint8Array(headerLength);
  const set32 = (at: number, n: number): void => mobi.set(be32(n), at - 16);
  mobi.set(asc('MOBI'), 0);
  set32(20, headerLength);
  set32(24, 2);
  set32(28, 65001);
  set32(36, o.version ?? 6);
  set32(92, 9);
  set32(108, 2); // first image record
  set32(128, 0x40);
  const fullNameOffset = 16 + headerLength + exthBlock.length;
  set32(84, fullNameOffset);
  set32(88, title.length);
  const palm = concat(be16(2), be16(0), be32(1000), be16(1), be16(4096), be16(o.encryption ?? 0), be16(0));
  const rec0 = concat(palm, mobi, exthBlock, title, new Array(64).fill(0));
  const recordsCount = o.cover ? 3 : 2;
  const listLength = 78 + recordsCount * 8 + 2;
  const rec0Offset = listLength;
  const rec1Offset = rec0Offset + rec0.length;
  const header = new Uint8Array(78);
  header.set(asc('Sample Book'), 0);
  header.set(asc('BOOKMOBI'), 60);
  header.set(be16(recordsCount), 76);
  const list: number[] = [];
  list.push(...be32(rec0Offset), 0, 0, 0, 0);
  list.push(...be32(rec1Offset), 0, 0, 0, 2);
  const text = bytesOf('Some text of the book.');
  if (o.cover) list.push(...be32(rec1Offset + text.length), 0, 0, 0, 4);
  return concat(header, list, [0, 0], rec0, text, o.cover ?? []);
}

export function makeFb2(o: { title?: string; author?: [string, string]; encoding?: string; cover?: Uint8Array; salt?: string } = {}): Uint8Array<ArrayBuffer> {
  const b64 = o.cover ? btoa(String.fromCharCode(...o.cover)) : '';
  const xml = `<?xml version="1.0" encoding="${o.encoding ?? 'utf-8'}"?>\n<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink"><description><title-info><genre>prose</genre><author><first-name>${o.author?.[0] ?? 'Fiona'}</first-name><last-name>${o.author?.[1] ?? 'Booker'}</last-name></author><book-title>${o.title ?? 'An FB2 Story'}</book-title><lang>en</lang>${o.cover ? '<coverpage><image l:href="#cover.png"/></coverpage>' : ''}<sequence name="Tales" number="1"/></title-info></description><body><section><p>Once upon a time. ${o.salt ?? ''}</p></section></body>${o.cover ? `<binary id="cover.png" content-type="image/png">${b64}</binary>` : ''}</FictionBook>`;
  return concat(bytesOf(xml));
}

export const makeText = (s = 'Chapter 1\n\nIt was a quiet night. '): Uint8Array<ArrayBuffer> => concat(bytesOf(s));
export const makeUtf16Text = (s = 'Hello, wörld. Plain text in UTF-16.\n'): Uint8Array<ArrayBuffer> => concat([0xff, 0xfe], ...[...s].map((c) => le16(c.charCodeAt(0))));
export const makeLatin1Text = (): Uint8Array<ArrayBuffer> => Uint8Array.from([...'Caf'].map((c) => c.charCodeAt(0)).concat([0xe9, 0x20]), (x) => x);
export const makeHtml = (title = 'An HTML Page'): Uint8Array<ArrayBuffer> => concat(bytesOf(`<!DOCTYPE html><html><head><title>${title}</title></head><body><p>hi</p></body></html>`));
export const makeRtf = (): Uint8Array<ArrayBuffer> => concat(bytesOf('{\\rtf1\\ansi Hello}'));

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

const syncsafe = (n: number): number[] => [(n >>> 21) & 127, (n >>> 14) & 127, (n >>> 7) & 127, n & 127];

function id3Frame(id: string, text: string): number[] {
  const data = [3, ...bytesOf(text)];
  return [...asc(id), ...be32(data.length), 0, 0, ...data];
}

/** MP3: optional ID3v2.4 tag followed by real MPEG-1 Layer III frames (128 kbps, 44.1 kHz). */
export function makeMp3(o: { title?: string; album?: string; artist?: string; frames?: number; id3?: boolean; leadingPadding?: number } = {}): Uint8Array<ArrayBuffer> {
  const frames = o.frames ?? 20;
  const frame = new Uint8Array(417);
  frame.set([0xff, 0xfb, 0x90, 0x64]);
  const audio = concat(...Array.from({ length: frames }, () => frame));
  if (o.id3 === false) return audio;
  const tagBody = concat(
    o.title ? id3Frame('TIT2', o.title) : [],
    o.album ? id3Frame('TALB', o.album) : [],
    o.artist ? id3Frame('TPE1', o.artist) : [],
    new Array(o.leadingPadding ?? 0).fill(0),
  );
  return concat(asc('ID3'), [4, 0, 0], syncsafe(tagBody.length), tagBody, audio);
}

function box(type: string, ...payload: (Uint8Array | number[])[]): Uint8Array<ArrayBuffer> {
  const body = concat(...payload);
  return concat(be32(8 + body.length), asc(type), body);
}

/** MP4 audio: `M4B ` or `M4A ` brand, one AAC track, optional `chpl` chapters, optional DRM sample entry or video track. */
export function makeMp4Audio(o: { brand?: string; title?: string; album?: string; chapters?: [string, number][]; drm?: boolean; video?: boolean; seconds?: number } = {}): Uint8Array<ArrayBuffer> {
  const brand = o.brand ?? 'M4A ';
  const seconds = o.seconds ?? 10;
  const timescale = 1000;
  const ftyp = box('ftyp', asc(brand), be32(0), asc(brand), asc('isom'));
  const mvhd = box('mvhd', [0, 0, 0, 0], be32(0), be32(0), be32(timescale), be32(seconds * timescale), be32(0x00010000), be16(0x0100), new Array(10).fill(0), be32(0x00010000), be32(0), be32(0), be32(0), be32(0x00010000), be32(0), be32(0), be32(0), be32(0x40000000), new Array(24).fill(0), be32(2));
  const trak = (handler: string, entry: string): Uint8Array<ArrayBuffer> =>
    box(
      'trak',
      box('tkhd', [0, 0, 0, 7], be32(0), be32(0), be32(1), be32(0), be32(seconds * timescale), new Array(60).fill(0)),
      box(
        'mdia',
        box('mdhd', [0, 0, 0, 0], be32(0), be32(0), be32(44100), be32(seconds * 44100), be16(0x55c4), be16(0)),
        box('hdlr', [0, 0, 0, 0], be32(0), asc(handler), new Array(12).fill(0), [0]),
        box('minf', box('stbl', box('stsd', [0, 0, 0, 0], be32(1), box(entry, new Array(6).fill(0), be16(1), new Array(8).fill(0), be16(2), be16(16), be32(0), be32(44100 * 65536)))), box('stts', [0, 0, 0, 0], be32(0)), box('stsc', [0, 0, 0, 0], be32(0)), box('stsz', [0, 0, 0, 0], be32(0), be32(0)), box('stco', [0, 0, 0, 0], be32(0))),
      ),
    );
  const ilst = box(
    'ilst',
    o.title ? box('\u00a9nam', box('data', be32(1), be32(0), bytesOf(o.title))) : [],
    o.album ? box('\u00a9alb', box('data', be32(1), be32(0), bytesOf(o.album))) : [],
  );
  const chpl = o.chapters
    ? box('chpl', [1, 0, 0, 0], be32(0), [o.chapters.length], ...o.chapters.map(([name, sec]) => concat(be32(0), be32(sec * 10_000_000), [bytesOf(name).length], bytesOf(name))))
    : [];
  const udta = box('udta', box('meta', [0, 0, 0, 0], box('hdlr', [0, 0, 0, 0], be32(0), asc('mdir'), asc('appl'), new Array(9).fill(0)), ilst), chpl);
  const moov = box('moov', mvhd, trak('soun', o.drm ? 'drms' : 'mp4a'), o.video ? trak('vide', 'avc1') : [], udta);
  return concat(ftyp, moov, box('mdat', new Array(32).fill(0)));
}

function oggPage(headerType: number, serial: number, seq: number, payload: Uint8Array): Uint8Array<ArrayBuffer> {
  const page = concat(asc('OggS'), [0, headerType], new Array(8).fill(0), le32(serial), le32(seq), [0, 0, 0, 0], [1, payload.length], payload);
  const crcTable = (): Uint32Array => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let r = i << 24;
      for (let k = 0; k < 8; k += 1) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
      t[i] = r >>> 0;
    }
    return t;
  };
  const t = crcTable();
  let crc = 0;
  for (const b of page) crc = ((crc << 8) ^ (t[((crc >>> 24) ^ b) & 255] as number)) >>> 0;
  page.set(le32(crc), 22);
  return page;
}

/** Ogg Opus (`OpusHead`) or Ogg Vorbis (identification header). */
export function makeOgg(kind: 'opus' | 'vorbis' = 'opus'): Uint8Array<ArrayBuffer> {
  const head =
    kind === 'opus'
      ? concat(asc('OpusHead'), [1, 2], le16(312), le32(48000), le16(0), [0])
      : concat([1], asc('vorbis'), le32(0), [2], le32(44100), le32(0), le32(128000), le32(0), [0xb8, 1]);
  const tags = kind === 'opus' ? concat(asc('OpusTags'), le32(4), asc('test'), le32(0)) : concat([3], asc('vorbis'), le32(4), asc('test'), le32(0), [1]);
  return concat(oggPage(2, 1234, 0, head), oggPage(0, 1234, 1, tags), oggPage(4, 1234, 2, new Uint8Array(0)));
}

export function makeFlac(): Uint8Array<ArrayBuffer> {
  const sampleRate = 44100;
  const totalSamples = 44100 * 3;
  const info = new Uint8Array(34);
  info.set(be16(4096), 0);
  info.set(be16(4096), 2);
  // 20 bits sample rate, 3 bits channels-1, 5 bits bps-1, 36 bits total samples
  const packed = (BigInt(sampleRate) << 44n) | (1n << 41n) | (15n << 36n) | BigInt(totalSamples);
  for (let i = 0; i < 8; i += 1) info[10 + i] = Number((packed >> BigInt(56 - 8 * i)) & 0xffn);
  return concat(asc('fLaC'), [0x80, 0, 0, 34], info, new Array(64).fill(0));
}

export function makeWav(seconds = 1): Uint8Array<ArrayBuffer> {
  const rate = 8000;
  const data = new Uint8Array(rate * seconds).fill(128);
  return concat(asc('RIFF'), le32(36 + data.length), asc('WAVE'), asc('fmt '), le32(16), le16(1), le16(1), le32(rate), le32(rate), le16(1), le16(8), asc('data'), le32(data.length), data);
}

export function makeAac(): Uint8Array<ArrayBuffer> {
  // ADTS: MPEG-4, AAC LC, 44.1 kHz, stereo, frame length 100 bytes.
  const frame = new Uint8Array(100);
  frame.set([0xff, 0xf1, 0x50, 0x80, 0x0c, 0x9f, 0xfc]);
  return concat(...Array.from({ length: 6 }, () => frame));
}
