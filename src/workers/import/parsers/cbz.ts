import { decodeXml, naturalCompare } from '../bytes';
import { imageType } from '../sniff';
import { cleanText, type ParsedMeta } from '../types';
import { findAll, parseXml } from '../xml';
import { findEntry, readZipEntries, readZipEntry } from '../zip';

const IMAGE = /\.(jpe?g|png|gif|webp|bmp|avif)$/i;

/** Page count and first page as the cover; ComicInfo.xml supplies title, series and writer when present. */
export async function parseCbz(file: Blob): Promise<ParsedMeta> {
  const entries = await readZipEntries(file);
  const pages = entries
    .filter((e) => !e.isDirectory && IMAGE.test(e.name) && !e.name.startsWith('__MACOSX/'))
    .sort((a, b) => naturalCompare(a.name, b.name));
  const out: ParsedMeta = { pages: pages.length };
  const info = findEntry(entries, 'ComicInfo.xml');
  if (info) {
    const root = parseXml(decodeXml(await readZipEntry(file, info, 1_000_000)));
    const text = (name: string): string | undefined => cleanText(findAll(root, name)[0]?.text);
    const series = text('series');
    const title = text('title');
    const number = text('number');
    if (series) out.series = series;
    const composed = title ?? (series ? (number ? `${series} ${number}` : series) : undefined);
    if (composed) out.title = composed;
    const writer = text('writer');
    if (writer) out.author = writer;
  }
  const first = pages[0];
  if (first) {
    const bytes = await readZipEntry(file, first, 12 * 1024 * 1024).catch(() => undefined);
    if (bytes && imageType(bytes)) out.cover = { bytes };
  }
  return out;
}
