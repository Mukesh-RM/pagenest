import { ascii, decodeText, readRange } from '../bytes';
import { imageType } from '../sniff';
import { cleanLanguage, cleanText, type ParsedMeta } from '../types';
import { findAll, findFirst, parseXml, type XmlNode } from '../xml';

const HEAD_BYTES = 1024 * 1024;
const CHUNK = 4 * 1024 * 1024;
const MAX_COVER_BASE64 = 16 * 1024 * 1024;

function nameOf(author: XmlNode): string | undefined {
  const part = (n: string): string => findFirst(author, n)?.text ?? '';
  return cleanText([part('first-name'), part('middle-name'), part('last-name')].filter(Boolean).join(' ') || part('nickname'));
}

/** Title, authors, series, language and cover from an FB2 file (any declared encoding). */
export async function parseFb2(file: Blob): Promise<ParsedMeta> {
  const head = await readRange(file, 0, HEAD_BYTES);
  const declared = /<\?xml[^>]*encoding\s*=\s*["']([\w.:-]+)["']/i.exec(ascii(head, 0, 200))?.[1];
  const text = decodeText(head, declared ?? 'utf-8');
  const end = text.indexOf('</description>');
  const description = parseXml(end === -1 ? text : text.slice(0, end + 14));
  const info = findFirst(description, 'title-info');
  const out: ParsedMeta = {};
  if (!info) return out;
  const title = cleanText(findFirst(info, 'book-title')?.text);
  if (title) out.title = title;
  const authors = findAll(info, 'author').map(nameOf).filter((v): v is string => v !== undefined);
  if (authors.length > 0) out.author = authors.slice(0, 3).join(', ');
  const language = cleanLanguage(findFirst(info, 'lang')?.text);
  if (language) out.language = language;
  const series = cleanText(findFirst(info, 'sequence')?.attrs['name']);
  if (series) out.series = series;
  const href = findFirst(findFirst(info, 'coverpage') ?? info, 'image')?.attrs['href'];
  if (href) {
    const bytes = await findBinary(file, href.replace(/^#/, ''));
    if (bytes && imageType(bytes)) out.cover = { bytes };
  }
  return out;
}

/** Find `<binary id="...">` anywhere in the file by scanning in chunks, then decode its base64. */
async function findBinary(file: Blob, id: string): Promise<Uint8Array | undefined> {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const open = new RegExp(`<binary[^>]*\\bid\\s*=\\s*["']${escaped}["'][^>]*>`, 'i');
  const overlap = 2048;
  for (let at = 0; at < file.size; at += CHUNK) {
    const bytes = await readRange(file, at, CHUNK + overlap);
    const latin = ascii(bytes, 0, bytes.length);
    const m = open.exec(latin);
    if (!m) continue;
    const startAbs = at + m.index + m[0].length;
    // Read forward until the closing tag.
    let collected = '';
    for (let pos = startAbs; pos < file.size && collected.length < MAX_COVER_BASE64; pos += 1024 * 1024) {
      const piece = await readRange(file, pos, 1024 * 1024);
      const s = ascii(piece, 0, piece.length);
      const close = s.indexOf('</binary>');
      if (close !== -1) {
        collected += s.slice(0, close);
        return decodeBase64(collected);
      }
      collected += s;
    }
    return undefined;
  }
  return undefined;
}

function decodeBase64(text: string): Uint8Array | undefined {
  try {
    const binary = atob(text.replace(/[^A-Za-z0-9+/=]/g, ''));
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return undefined;
  }
}
