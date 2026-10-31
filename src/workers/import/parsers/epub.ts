import { decodeXml } from '../bytes';
import { cleanLanguage, cleanText, type CoverBytes, type ParsedMeta } from '../types';
import { findAll, findFirst, parseXml, type XmlNode } from '../xml';
import { findEntry, readZipEntries, readZipEntry, type ZipEntry } from '../zip';
import { imageType } from '../sniff';

const MAX_COVER_BYTES = 12 * 1024 * 1024;

/** Resolve `href` (URL-encoded, may contain `../`) against the folder of the package file. */
export function resolveHref(baseFile: string, href: string): string {
  const base = baseFile.includes('/') ? baseFile.slice(0, baseFile.lastIndexOf('/') + 1) : '';
  let clean = href.split('#')[0] ?? '';
  try {
    clean = decodeURIComponent(clean);
  } catch {
    /* keep as is */
  }
  const out: string[] = [];
  for (const part of `${base}${clean}`.split('/')) {
    if (part === '..') out.pop();
    else if (part !== '.' && part !== '') out.push(part);
  }
  return out.join('/');
}

async function readText(file: Blob, entries: readonly ZipEntry[], name: string, max = 4 * 1024 * 1024): Promise<string | undefined> {
  const entry = findEntry(entries, name);
  if (!entry || entry.isDirectory) return undefined;
  return decodeXml(await readZipEntry(file, entry, max));
}

/** Title, author, language, series and cover from an EPUB's package file. */
export async function parseEpub(file: Blob): Promise<ParsedMeta> {
  const entries = await readZipEntries(file);
  const containerXml = await readText(file, entries, 'META-INF/container.xml');
  let opfPath = containerXml ? findAll(parseXml(containerXml), 'rootfile')[0]?.attrs['full-path'] : undefined;
  if (!opfPath || !findEntry(entries, opfPath)) {
    opfPath = entries.find((e) => /\.opf$/i.test(e.name))?.name;
  }
  if (!opfPath) return {};
  const opfXml = await readText(file, entries, opfPath);
  if (!opfXml) return {};
  const root = parseXml(opfXml);
  const meta = findFirst(root, 'metadata');
  const out: ParsedMeta = {};
  if (meta) {
    const text = (name: string): string | undefined => cleanText(findAll(meta, name)[0]?.text);
    const title = text('title');
    if (title) out.title = title;
    const creators = findAll(meta, 'creator')
      .filter((c) => !c.attrs['role'] || c.attrs['role'] === 'aut')
      .map((c) => cleanText(c.text))
      .filter((v): v is string => v !== undefined);
    const author = creators.length > 0 ? creators.slice(0, 3).join(', ') : text('creator');
    if (author) out.author = author;
    const language = cleanLanguage(text('language'));
    if (language) out.language = language;
    const narrator = findAll(meta, 'contributor').find((c) => c.attrs['role'] === 'nrt');
    if (narrator) {
      const n = cleanText(narrator.text);
      if (n) out.narrator = n;
    }
    const series = findSeries(meta);
    if (series) out.series = series;
  }
  const cover = await findCover(file, entries, root, opfPath);
  if (cover) out.cover = cover;
  return out;
}

function findSeries(meta: XmlNode): string | undefined {
  const metas = findAll(meta, 'meta');
  const calibre = metas.find((m) => m.attrs['name'] === 'calibre:series');
  if (calibre?.attrs['content']) return cleanText(calibre.attrs['content']);
  const collection = metas.find((m) => m.attrs['property'] === 'belongs-to-collection');
  if (collection) {
    const id = collection.attrs['id'];
    const type = id ? metas.find((m) => m.attrs['refines'] === `#${id}` && m.attrs['property'] === 'collection-type') : undefined;
    if (!type || type.text === 'series') return cleanText(collection.text);
  }
  return undefined;
}

async function findCover(file: Blob, entries: readonly ZipEntry[], opf: XmlNode, opfPath: string): Promise<CoverBytes | undefined> {
  const items = findAll(opf, 'item');
  const isImage = (item: XmlNode): boolean => /^image\//i.test(item.attrs['media-type'] ?? '') || /\.(jpe?g|png|gif|webp)$/i.test(item.attrs['href'] ?? '');
  const byProperty = items.find((i) => (i.attrs['properties'] ?? '').split(/\s+/).includes('cover-image'));
  const coverId = findAll(opf, 'meta').find((m) => m.attrs['name'] === 'cover')?.attrs['content'];
  const byMeta = coverId ? items.find((i) => i.attrs['id'] === coverId) : undefined;
  const byName = items.find((i) => isImage(i) && /cover/i.test(`${i.attrs['id'] ?? ''} ${i.attrs['href'] ?? ''}`));
  const candidates = [byProperty, byMeta, byName].filter((i): i is XmlNode => i !== undefined);

  // The guide may point to a cover page whose first image is the picture.
  for (const item of candidates) {
    const href = item.attrs['href'];
    if (!href) continue;
    const entry = findEntry(entries, resolveHref(opfPath, href));
    if (!entry) continue;
    const bytes = await readZipEntry(file, entry, MAX_COVER_BYTES).catch(() => undefined);
    if (bytes && imageType(bytes)) return { bytes };
    if (bytes && /x?html/i.test(item.attrs['media-type'] ?? '')) {
      const html = decodeXml(bytes);
      const src = /<(?:img|image)[^>]+(?:src|href)\s*=\s*["']([^"']+)["']/i.exec(html)?.[1];
      if (src) {
        const inner = findEntry(entries, resolveHref(resolveHref(opfPath, href), src));
        const innerBytes = inner ? await readZipEntry(file, inner, MAX_COVER_BYTES).catch(() => undefined) : undefined;
        if (innerBytes && imageType(innerBytes)) return { bytes: innerBytes };
      }
    }
  }
  return undefined;
}
