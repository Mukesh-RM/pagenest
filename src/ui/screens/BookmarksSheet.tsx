import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import type { PlayerBookmark } from '../types';
import { formatClock } from '../utils/time';

export interface BookmarksSheetProps {
  open: boolean;
  onClose: () => void;
  bookmarks: readonly PlayerBookmark[];
  /** Tap a bookmark: go there. The sheet closes. */
  onSeek: (positionSec: number) => void;
  /** Adds a bookmark at the current position. Omit to hide the button. */
  onAdd?: () => void;
  /** Removes one. The app can offer Undo; there is no confirm step for something this small. */
  onDelete?: (bookmark: PlayerBookmark) => void;
}

const nameOf = (bookmark: PlayerBookmark): string => bookmark.label?.trim() || 'Bookmark';

/**
 * The bookmarks of the book being played: time, label and chapter, in book order. Tap a row to go there; the trash
 * button deletes. A bottom sheet (system back and Esc close it first), so the player stays where it was.
 */
export function BookmarksSheet({ open, onClose, bookmarks, onSeek, onAdd, onDelete }: BookmarksSheetProps) {
  const sorted = [...bookmarks].sort((a, b) => a.positionSec - b.positionSec);
  return (
    <BottomSheet
      open={open}
      title="Bookmarks"
      onClose={() => onClose()}
      className="pn-bookmarks"
      footer={
        onAdd ? (
          <Button block variant="secondary" icon="bookmark" onClick={onAdd}>
            Add bookmark here
          </Button>
        ) : undefined
      }
    >
      {sorted.length === 0 ? (
        <p className="pn-bookmarks__empty">No bookmarks yet. Add one to keep your place in this book.</p>
      ) : (
        <ul className="pn-bookmarks__list" aria-label="Bookmarks">
          {sorted.map((bookmark) => {
            const clock = formatClock(bookmark.positionSec);
            const note = bookmark.label?.trim();
            return (
              <li key={bookmark.id} className="pn-bookmarks__row">
                <button
                  type="button"
                  className="pn-bookmarks__go"
                  aria-label={`Go to ${clock}${note ? `, ${note}` : ''}`}
                  onClick={() => {
                    onSeek(bookmark.positionSec);
                    onClose();
                  }}
                >
                  <span className="pn-bookmarks__time">{clock}</span>
                  <span className="pn-bookmarks__text">
                    <span className="pn-bookmarks__label">{nameOf(bookmark)}</span>
                    {bookmark.chapter ? <span className="pn-bookmarks__chapter">{bookmark.chapter}</span> : null}
                  </span>
                </button>
                {onDelete ? (
                  <Button iconOnly variant="ghost" icon="trash" aria-label={`Delete bookmark at ${clock}${note ? `, ${note}` : ''}`} onClick={() => onDelete(bookmark)} />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}
