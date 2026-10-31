import type { BookmarkRecord, HighlightRecord } from '@/data/schema';
import { BottomSheet, Button, cx, type SheetCloseReason } from '@/ui';

type Panel = 'bookmarks' | 'highlights' | 'notes';

interface Props {
  readonly open: boolean;
  readonly onClose: (reason: SheetCloseReason) => void;
  readonly bookmarks: readonly BookmarkRecord[];
  readonly highlights: readonly HighlightRecord[];
  readonly notes: readonly HighlightRecord[];
  readonly panel: Panel;
  readonly onPanelChange: (panel: Panel) => void;
  readonly onGoToBookmark: (row: BookmarkRecord) => void;
  readonly onGoToHighlight: (row: HighlightRecord) => void;
  readonly onEditNote: (row: HighlightRecord) => void;
}

/** Bookmarks, highlights and notes for this book, with tap-to-jump. */
export function MarksSheet({
  open,
  onClose,
  bookmarks,
  highlights,
  notes,
  panel,
  onPanelChange,
  onGoToBookmark,
  onGoToHighlight,
  onEditNote,
}: Props) {
  const empty =
    (panel === 'bookmarks' && !bookmarks.length) ||
    (panel === 'highlights' && !highlights.length) ||
    (panel === 'notes' && !notes.length);

  return (
    <BottomSheet open={open} onClose={onClose} title="Marks in this book" className="pn-live-marks">
      <div className="pn-live-marks__tabs" role="tablist" aria-label="Marks panels">
        {(
          [
            ['bookmarks', 'Bookmarks'],
            ['highlights', 'Highlights'],
            ['notes', 'Notes'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={panel === id}
            className={cx('pn-live-marks__tab', panel === id && 'pn-live-marks__tab--active')}
            onClick={() => onPanelChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {empty ? (
        <p className="pn-live-search__hint">
          {panel === 'bookmarks' ? 'No bookmarks yet.' : panel === 'notes' ? 'No notes yet. Add a note to a highlight.' : 'No highlights yet.'}
        </p>
      ) : null}
      {panel === 'bookmarks' && bookmarks.length ? (
        <ul className="pn-live-list" role="tabpanel" aria-label="Bookmarks">
          {bookmarks.map((row) => (
            <li key={row.id}>
              <button type="button" className="pn-live-list__row" onClick={() => onGoToBookmark(row)}>
                {row.label || 'Bookmark'}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {panel === 'highlights' && highlights.length ? (
        <ul className="pn-live-list" role="tabpanel" aria-label="Highlights">
          {highlights.map((row) => (
            <li key={row.id}>
              <div className={cx('pn-live-marks__hl', `pn-live-marks__hl--${row.color}`)}>
                <button type="button" className="pn-live-list__row" onClick={() => onGoToHighlight(row)}>
                  <span>{row.text.slice(0, 120)}{row.text.length > 120 ? '…' : ''}</span>
                </button>
                <Button variant="ghost" onClick={() => onEditNote(row)}>
                  {row.note ? 'Edit note' : 'Add note'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {panel === 'notes' && notes.length ? (
        <ul className="pn-live-list" role="tabpanel" aria-label="Notes">
          {notes.map((row) => (
            <li key={row.id}>
              <button type="button" className="pn-live-list__row pn-live-marks__note-row" onClick={() => onEditNote(row)}>
                <span className="pn-live-marks__note">{row.note}</span>
                <span className="pn-live-marks__note-excerpt">{row.text.slice(0, 80)}{row.text.length > 80 ? '…' : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </BottomSheet>
  );
}
