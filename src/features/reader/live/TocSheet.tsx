import { useMemo } from 'react';
import type { Locator } from '@/app/contracts';
import type { ReaderPosition, TocItem } from '@/engines/reader/types';
import { BottomSheet, EmptyState, cx, type SheetCloseReason } from '@/ui';
import { currentTocIndex } from '../core/toc';

interface Props {
  readonly open: boolean;
  readonly onClose: (reason: SheetCloseReason) => void;
  readonly toc: readonly TocItem[];
  readonly position: ReaderPosition | undefined;
  readonly onGoTo: (locator: Locator) => void;
}

interface Flat {
  readonly item: TocItem;
  readonly depth: number;
  readonly key: string;
}

function flatten(items: readonly TocItem[], depth = 0, prefix = ''): Flat[] {
  return items.flatMap((item, i) => {
    const key = `${prefix}${i}`;
    return [{ item, depth, key }, ...flatten(item.children ?? [], depth + 1, `${key}.`)];
  });
}

/** The table of contents, with the current chapter marked. */
export function TocSheet({ open, onClose, toc, position, onGoTo }: Props) {
  const flat = useMemo(() => flatten(toc), [toc]);
  const current = currentTocIndex(flat, position);
  return (
    <BottomSheet open={open} onClose={onClose} title="Contents" className="pn-live-toc">
      {flat.length ? (
        <ul className="pn-live-list" aria-label="Chapters">
          {flat.map(({ item, depth, key }, i) => (
            <li key={key}>
              <button
                type="button"
                className={cx('pn-live-list__row', i === current && 'pn-live-list__row--current')}
                style={{ paddingInlineStart: `calc(var(--pn-space-4) + ${depth} * var(--pn-space-4))` }}
                aria-current={i === current ? 'location' : undefined}
                onClick={() => onGoTo(item.locator)}
              >
                {item.title}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState art="list" title="No contents in this file" description="Use the scrubber at the bottom of the page to move around." headingLevel={3} />
      )}
    </BottomSheet>
  );
}
