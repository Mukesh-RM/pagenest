import { describe, expect, it } from 'vitest';
import type { TocItem } from '@/engines/reader/types';
import { currentReaderTocId, locatorForReaderTocId, readerTocFromEngine } from './toc-map';

describe('readerTocFromEngine', () => {
  const toc: TocItem[] = [
    { title: 'One', locator: { kind: 'reflow', section: 0, textOffset: 0 } },
    {
      title: 'Two',
      locator: { kind: 'reflow', section: 1, textOffset: 0 },
      children: [{ title: 'Two A', locator: { kind: 'reflow', section: 1, textOffset: 10 } }],
    },
  ];

  it('assigns stable ids and locators', () => {
    const { tree, flat } = readerTocFromEngine(toc);
    expect(tree).toHaveLength(2);
    expect(tree[1]?.children?.[0]?.id).toBe('1.0');
    expect(locatorForReaderTocId(flat, '1.0')).toEqual({ kind: 'reflow', section: 1, textOffset: 10 });
  });

  it('marks the current section', () => {
    const { flat } = readerTocFromEngine(toc);
    const flatItems = toc.flatMap((item) => [item, ...(item.children ?? [])]).map((item) => ({ item }));
    const id = currentReaderTocId(flatItems, { locator: { kind: 'reflow', section: 1, textOffset: 12 }, percent: 40 }, flat);
    expect(id).toBe('1.0');
  });
});
