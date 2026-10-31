import { decodeXml } from '../bytes';
import { cleanLanguage, cleanText, type ParsedMeta } from '../types';
import { findAll, parseXml } from '../xml';
import { findEntry, readZipEntries, readZipEntry } from '../zip';

/** Title, author and language from `docProps/core.xml` of a DOCX. */
export async function parseDocx(file: Blob): Promise<ParsedMeta> {
  const entries = await readZipEntries(file);
  const core = findEntry(entries, 'docProps/core.xml');
  if (!core) return {};
  const root = parseXml(decodeXml(await readZipEntry(file, core, 1_000_000)));
  const first = (name: string): string | undefined => cleanText(findAll(root, name)[0]?.text);
  const out: ParsedMeta = {};
  const title = first('title');
  if (title) out.title = title;
  const author = first('creator');
  if (author) out.author = author;
  const language = cleanLanguage(first('language'));
  if (language) out.language = language;
  return out;
}
