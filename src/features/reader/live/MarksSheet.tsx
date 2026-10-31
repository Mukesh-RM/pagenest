import type { BookmarkRecord, HighlightRecord } from '@/data/schema';
import type { HighlightColor } from '@/engines/reader/types';
import { BottomSheet, Button, cx, type SheetCloseReason } from '@/ui';

const COLOR_LABEL: Record<HighlightColor, string> = {
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  pink: 'Pink',
};

interface Props {
  readonly open: boolean;
  readonly onClose: (reason: SheetCloseReason) => void;
  readonly bookmarks: readonly BookmarkRecord[];
  readonly highlights: readonly HighlightRecord[];
  readonly onGoToBookmark: (row: BookmarkRecord) => void;
  readonly onGoToHighlight: (row: HighlightRecord) => void;
  readonly onEditNote: (row: HighlightRecord) => void;
}

/** Bookmarks and highlights for this book, with tap-to-jump. */
export function MarksSheet({
  open,
  onClose,
  bookmarks,
  highlights,
  onGoToBookmark,
  onGoToHighlight,
  onEditNote,
}: Props) {
  const empty = !bookmarks.length && !highlights.length;
  return (
    <BottomSheet open={open} onClose={onClose} title="Bookmarks and highlights" className="pn-live-marks">
      {empty ? (
        <p className="pn-live-search__hint">Nothing saved yet. Add a bookmark or highlight while you read.</p>
      ) : (
        <>
          {bookmarks.length ? (
            <>
              <h2 className="pn-live-marks__heading">Bookmarks</h2>
              <ul className="pn-live-list" aria-label="Bookmarks">
                {bookmarks.map((row) => (
                  <li key={row.id}>
                    <button type="button" className="pn-live-list__row" onClick={() => onGoToBookmark(row)}>
                      {row.label || 'Bookmark'}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {highlights.length ? (
            <>
              <h2 className="pn-live-marks__heading">Highlights</h2>
              <ul className="pn-live-list" aria-label="Highlights">
                {highlights.map((row) => (
                  <li key={row.id}>
                    <div className={cx('pn-live-marks__hl', `pn-live-marks__hl--${row.color}`)}>
                      <button type="button" className="pn-live-list__row" onClick={() => onGoToHighlight(row)}>
                        <span>{row.text.slice(0, 120)}{row.text.length > 120 ? '…' : ''}</span>
                        {row.note ? <span className="pn-live-marks__note">{row.note}</span> : null}
                      </button>
                      <Button variant="ghost" aria-label={`Note on ${COLOR_LABEL[row.color]} highlight`} onClick={() => onEditNote(row)}>
                        Note
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}
    </BottomSheet>
  );
}
