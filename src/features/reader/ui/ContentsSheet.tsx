import { useMemo, type ReactNode } from 'react';
import type { Locator, TextRange } from '@/app/contracts';
import type { BookmarkRecord, HighlightRecord } from '@/data/schema';
import type { HighlightColor, ReaderPosition, TocItem } from '@/engines/reader/types';
import { BottomSheet, EmptyState, cx, type SheetCloseReason } from '@/ui';
import { HIGHLIGHT_FILL } from '../core/appearance';
import { currentTocIndex } from '../core/toc';
import { Bookmark, Highlighter, List, Trash2 } from './icons';
import { IconButton } from './IconButton';

export type ContentsTab = 'contents' | 'bookmarks' | 'highlights';

interface Props {
  readonly open: boolean;
  readonly tab: ContentsTab;
  readonly onTab: (tab: ContentsTab) => void;
  readonly onClose: (reason: SheetCloseReason) => void;
  readonly toc: readonly TocItem[];
  readonly position: ReaderPosition | undefined;
  readonly bookmarks: readonly BookmarkRecord[];
  readonly highlights: readonly HighlightRecord[];
  readonly onGoTo: (locator: Locator) => void;
  readonly onGoToRange: (range: TextRange) => void;
  readonly onRemoveBookmark: (bookmark: BookmarkRecord) => void;
  readonly onEditHighlight: (highlight: HighlightRecord) => void;
}

interface FlatItem {
  readonly item: TocItem;
  readonly depth: number;
  readonly key: string;
}

function flatten(items: readonly TocItem[], depth = 0, prefix = ''): FlatItem[] {
  return items.flatMap((item, i) => {
    const key = `${prefix}${i}`;
    return [{ item, depth, key }, ...flatten(item.children ?? [], depth + 1, `${key}.`)];
  });
}

function describeLocator(locator: Locator, label: string): string {
  return locator.kind === 'page' ? `Page ${locator.page}` : label;
}

const TAB_LABEL: Record<ContentsTab, string> = { contents: 'Contents', bookmarks: 'Bookmarks', highlights: 'Highlights' };

/** Contents, bookmarks, highlights and notes in one sheet. */
export function ContentsSheet(props: Props) {
  const { open, tab, onTab, onClose, toc, position, bookmarks, highlights } = props;
  const flat = useMemo(() => flatten(toc), [toc]);
  const current = currentTocIndex(flat, position);

  let body: ReactNode;
  if (tab === 'contents') {
    body = flat.length ? (
      <ul className="pn-list" aria-label="Chapters">
        {flat.map(({ item, depth, key }, i) => (
          <li key={key}>
            <button
              type="button"
              className={cx('pn-list__row', i === current && 'pn-list__row--current')}
              style={{ paddingInlineStart: `calc(var(--pn-space-4) + ${depth} * var(--pn-space-4))` }}
              aria-current={i === current ? 'location' : undefined}
              onClick={() => {
                props.onGoTo(item.locator);
              }}
            >
              <span className="pn-list__title">{item.title}</span>
              {item.locator.kind === 'page' ? <span className="pn-list__meta">{item.locator.page}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <EmptyState art={<List size={40} aria-hidden="true" />} title="No contents in this file" description="Use the scrubber at the bottom of the page to move around." headingLevel={3} />
    );
  } else if (tab === 'bookmarks') {
    body = bookmarks.length ? (
      <ul className="pn-list" aria-label="Bookmarks">
        {bookmarks.map((b) => (
          <li key={b.id} className="pn-list__item">
            <button type="button" className="pn-list__row" onClick={() => props.onGoTo(b.locator)}>
              <span className="pn-list__title">{b.label || describeLocator(b.locator, 'Bookmark')}</span>
              <span className="pn-list__meta">{new Date(b.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            </button>
            <IconButton icon={Trash2} label={`Remove bookmark ${b.label}`} onClick={() => props.onRemoveBookmark(b)} />
          </li>
        ))}
      </ul>
    ) : (
      <EmptyState art={<Bookmark size={40} aria-hidden="true" />} title="No bookmarks yet" description="Tap the bookmark button at the top of the page to save your place." headingLevel={3} />
    );
  } else {
    body = highlights.length ? (
      <ul className="pn-list" aria-label="Highlights and notes">
        {highlights.map((h) => (
          <li key={h.id} className="pn-list__item">
            <button
              type="button"
              className="pn-list__row pn-list__row--highlight"
              style={{ ['--pn-hl' as string]: HIGHLIGHT_FILL[h.color as HighlightColor] }}
              onClick={() => props.onGoToRange(h.range)}
            >
              <span className="pn-list__quote">{h.text}</span>
              {h.note ? <span className="pn-list__note">{h.note}</span> : null}
            </button>
            <IconButton icon={Highlighter} label="Edit highlight and note" onClick={() => props.onEditHighlight(h)} />
          </li>
        ))}
      </ul>
    ) : (
      <EmptyState art={<Highlighter size={40} aria-hidden="true" />} title="No highlights yet" description="Select some text to highlight it or add a note." headingLevel={3} />
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Contents" hideTitle className="pn-contents">
      <div role="tablist" aria-label="Contents sections" className="pn-tabs">
        {(Object.keys(TAB_LABEL) as ContentsTab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`pn-tab-${t}`}
            aria-selected={tab === t}
            aria-controls="pn-tabpanel"
            tabIndex={tab === t ? 0 : -1}
            className="pn-tabs__tab"
            onClick={() => onTab(t)}
            onKeyDown={(e) => {
              const order = Object.keys(TAB_LABEL) as ContentsTab[];
              const i = order.indexOf(t);
              const next = e.key === 'ArrowRight' ? order[(i + 1) % order.length] : e.key === 'ArrowLeft' ? order[(i + order.length - 1) % order.length] : undefined;
              if (next) {
                e.preventDefault();
                onTab(next);
                requestAnimationFrame(() => document.getElementById(`pn-tab-${next}`)?.focus());
              }
            }}
          >
            {TAB_LABEL[t]}
            {t === 'bookmarks' && bookmarks.length ? <span className="pn-tabs__count">{bookmarks.length}</span> : null}
            {t === 'highlights' && highlights.length ? <span className="pn-tabs__count">{highlights.length}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="pn-tabpanel" aria-labelledby={`pn-tab-${tab}`} className="pn-contents__panel">
        {body}
      </div>
    </BottomSheet>
  );
}
