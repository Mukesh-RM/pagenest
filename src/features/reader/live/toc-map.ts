import type { Locator } from '@/app/contracts';
import type { ReaderPosition, TocItem } from '@/engines/reader/types';
import type { ReaderTocItem } from '@/ui/types';
import { currentTocIndex } from '../core/toc';

export interface TocEntry {
  readonly id: string;
  readonly locator: Locator;
}

/** Map engine TOC entries to design-system ids (stable for the life of the open book). */
export function readerTocFromEngine(items: readonly TocItem[]): { tree: readonly ReaderTocItem[]; flat: readonly TocEntry[] } {
  const flat: TocEntry[] = [];
  const walk = (list: readonly TocItem[], prefix: string): ReaderTocItem[] =>
    list.map((item, i) => {
      const id = `${prefix}${i}`;
      flat.push({ id, locator: item.locator });
      const children = item.children?.length ? walk(item.children, `${id}.`) : undefined;
      return { id, title: item.title, ...(children ? { children } : {}) };
    });
  return { tree: walk(items, ''), flat };
}

export function currentReaderTocId(flat: readonly { item: TocItem }[], position: ReaderPosition | undefined, entries: readonly TocEntry[]): string | undefined {
  const idx = currentTocIndex(flat, position);
  return idx >= 0 ? entries[idx]?.id : undefined;
}

export function locatorForReaderTocId(entries: readonly TocEntry[], id: string): Locator | undefined {
  return entries.find((e) => e.id === id)?.locator;
}
