import { useMemo } from 'react';
import { BottomSheet, type SheetCloseReason } from '../components/BottomSheet';
import { EmptyState } from '../components/EmptyState';
import { cx } from '../utils/cx';
import type { ReaderTocItem } from '../types';

export interface ReaderTocSheetProps {
  readonly open: boolean;
  readonly onClose: (reason: SheetCloseReason) => void;
  readonly items: readonly ReaderTocItem[];
  /** Id of the current chapter or section. */
  readonly currentId?: string;
  readonly onSelect: (item: ReaderTocItem) => void;
}

interface Flat {
  readonly item: ReaderTocItem;
  readonly depth: number;
}

function flatten(items: readonly ReaderTocItem[], depth = 0): Flat[] {
  return items.flatMap((item) => [{ item, depth }, ...flatten(item.children ?? [], depth + 1)]);
}

/** Table of contents for the reader, with the current section marked. */
export function ReaderTocSheet({ open, onClose, items, currentId, onSelect }: ReaderTocSheetProps) {
  const flat = useMemo(() => flatten(items), [items]);
  return (
    <BottomSheet open={open} onClose={onClose} title="Contents" className="pn-reader-toc">
      {flat.length ? (
        <ul className="pn-reader-toc__list" aria-label="Chapters">
          {flat.map(({ item, depth }) => (
            <li key={item.id}>
              <button
                type="button"
                className={cx('pn-reader-toc__row', item.id === currentId && 'pn-reader-toc__row--current')}
                style={{ paddingInlineStart: `calc(var(--pn-space-4) + ${depth} * var(--pn-space-4))` }}
                aria-current={item.id === currentId ? 'location' : undefined}
                onClick={() => onSelect(item)}
              >
                {item.title}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          art="list"
          title="No contents in this file"
          description="Use the scrubber at the bottom of the page to move around."
          headingLevel={3}
        />
      )}
    </BottomSheet>
  );
}
