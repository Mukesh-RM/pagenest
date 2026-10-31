import { ascii, decodeText, readRange, u16be, u32be } from '../bytes';
import { imageType } from '../sniff';
import { cleanLanguage, cleanText, type ParsedMeta } from '../types';

/** Mobipocket language ids (low byte) that appear in the wild, for files without an EXTH language record. */
const LANGUAGE_IDS: Readonly<Record<number, string>> = {
  9: 'en', 7: 'de', 12: 'fr', 10: 'es', 16: 'it', 25: 'ru', 21: 'pl', 19: 'nl', 22: 'pt', 29: 'sv', 20: 'no', 6: 'da', 11: 'fi', 4: 'zh', 17: 'ja', 18: 'ko', 1: 'ar', 13: 'he', 14: 'hu', 5: 'cs', 8: 'el', 31: 'tr', 2: 'bg', 34: 'uk', 57: 'hi', 61: 'ne',
};

async function recordOffset(file: Blob, index: number, count: number): Promise<number> {
  if (index >= count) return file.size;
  return u32be(await readRange(file, 78 + index * 8, 4), 0);
}

/** Title, authors, language and cover from a MOBI, AZW or AZW3 file. */
export async function parseMobi(file: Blob): Promise<ParsedMeta> {
  const head = await readRange(file, 0, 78 + 16);
  const count = u16be(head, 76);
  if (count < 2) return {};
  const rec0 = await recordOffset(file, 0, count);
  const rec1 = await recordOffset(file, 1, count);
  const size = Math.min(Math.max(rec1 - rec0, 0), 512 * 1024);
  const r = await readRange(file, rec0, size);
  const out: ParsedMeta = {};
  if (ascii(r, 16, 20) !== 'MOBI') return out;
  const headerLength = u32be(r, 20);
  const encoding = u32be(r, 28);
  const label = encoding === 65001 ? 'utf-8' : 'windows-1252';
  const fullNameOffset = u32be(r, 84);
  const fullNameLength = u32be(r, 88);
  let title = fullNameLength > 0 && fullNameLength < 2048 ? cleanText(decodeText(r.subarray(fullNameOffset, fullNameOffset + fullNameLength), label)) : undefined;
  const firstImage = u32be(r, 108);
  const languageId = u32be(r, 92) & 0xff;
  const lang = LANGUAGE_IDS[languageId];
  if (lang) out.language = lang;

  const exthFlags = u32be(r, 128);
  const exthStart = 16 + headerLength;
  let coverOffset: number | undefined;
  if ((exthFlags & 0x40) !== 0 && ascii(r, exthStart, exthStart + 4) === 'EXTH') {
    const total = u32be(r, exthStart + 4);
    const records = u32be(r, exthStart + 8);
    const authors: string[] = [];
    let at = exthStart + 12;
    for (let i = 0; i < records && at + 8 <= Math.min(exthStart + total, r.length); i += 1) {
      const type = u32be(r, at);
      const length = u32be(r, at + 4);
      if (length < 8) break;
      const data = r.subarray(at + 8, at + length);
      if (type === 100) {
        const a = cleanText(decodeText(data, label));
        if (a) authors.push(a);
      } else if (type === 503) {
        title = cleanText(decodeText(data, label)) ?? title;
      } else if (type === 524) {
        const l = cleanLanguage(decodeText(data, 'utf-8'));
        if (l) out.language = l;
      } else if (type === 201 && data.length >= 4) {
        coverOffset = u32be(data, 0);
      }
      at += length;
    }
    if (authors.length > 0) out.author = authors.slice(0, 3).join(', ');
  }
  if (title) out.title = title;

  if (coverOffset !== undefined && firstImage !== 0xffffffff && firstImage > 0) {
    const index = firstImage + coverOffset;
    if (index < count) {
      const start = await recordOffset(file, index, count);
      const end = await recordOffset(file, index + 1, count);
      if (end > start && end - start <= 12 * 1024 * 1024) {
        const bytes = await readRange(file, start, end - start);
        if (imageType(bytes)) out.cover = { bytes };
      }
    }
  }
  return out;
}
