import { compareLocators } from '@/app/contracts';
import type { ReaderPosition, TocItem } from '@/engines/reader/types';

/** Index of the entry the reader is in: the last one that starts at or before the position. */
export function currentTocIndex(flat: readonly { item: TocItem }[], position: ReaderPosition | undefined): number {
  if (!position) return -1;
  let found = -1;
  flat.forEach(({ item }, i) => {
    const cmp = compareLocators(item.locator, position.locator);
    if (cmp !== undefined && cmp <= 0) found = i;
  });
  if (found === -1 && position.chapterTitle) found = flat.findIndex(({ item }) => item.title === position.chapterTitle);
  return found;
}
