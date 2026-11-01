import type { Locator } from '@/app/contracts';
import type { ReaderDocumentExt } from '../core/ext-types';

function hostHasReadableContent(host: HTMLElement): boolean {
  const view = host.querySelector('foliate-view') as
    | (HTMLElement & { renderer?: { getContents: () => Array<{ doc: Document }> } })
    | null;
  const docs = view?.renderer?.getContents?.().map((c) => c.doc) ?? [];
  for (const doc of docs) {
    const text = (doc.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
    if (text.length >= 24) return true;
    const img = doc.querySelector('img');
    if (img instanceof HTMLImageElement && img.naturalWidth > 0 && img.naturalHeight > 0) return true;
    if (img instanceof HTMLImageElement && (img.offsetWidth > 40 || img.offsetHeight > 40)) return true;
  }
  const plain = (host.innerText ?? '').replace(/\s+/g, ' ').trim();
  return plain.length >= 24;
}

function flatToc(items: ReaderDocumentExt['toc']): Array<{ title: string; locator: Locator }> {
  const out: Array<{ title: string; locator: Locator }> = [];
  const walk = (list: typeof items): void => {
    for (const item of list) {
      out.push({ title: item.title, locator: item.locator });
      if (item.children?.length) walk(item.children);
    }
  };
  walk(items);
  return out;
}

/** On a fresh open, skip empty cover shells and land on the first page that shows text or a cover image. */
export async function ensureReadableStart(doc: ReaderDocumentExt, host: HTMLElement): Promise<void> {
  if (doc.layout !== 'reflow') return;
  if (hostHasReadableContent(host)) return;

  const entries = flatToc(doc.toc).filter((e) => e.locator.kind === 'reflow');
  const ordered = [
    ...entries.filter((e) => !/\bcover\b/i.test(e.title.trim())),
    ...entries.filter((e) => /\bcover\b/i.test(e.title.trim())),
  ];
  for (const entry of ordered) {
    await doc.goTo(entry.locator);
    if (hostHasReadableContent(host)) return;
  }
}
