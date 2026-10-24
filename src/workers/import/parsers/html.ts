import { decodeText, readRange } from '../bytes';
import { decodeEntities } from '../xml';
import { cleanText, type ParsedMeta } from '../types';

/** The `<title>` of an HTML document. */
export async function parseHtml(file: Blob): Promise<ParsedMeta> {
  const head = await readRange(file, 0, 64 * 1024);
  const charset = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(decodeText(head, 'latin1'))?.[1];
  const text = decodeText(head, charset ?? 'utf-8');
  const title = cleanText(decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(text)?.[1] ?? ''));
  return title ? { title } : {};
}
