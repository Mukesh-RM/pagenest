import { Button, Icon } from '@/ui';

export interface SelectionBarProps {
  count: number;
  total: number;
  allFavorite: boolean;
  onFavorite: () => void;
  onFinished: () => void;
  onShelf: () => void;
  onDetails?: (() => void) | undefined;
  onDelete: () => void;
  onSelectAll: () => void;
  onDone: () => void;
}

/** Actions for the selected books. Sits above the tab bar; each action is a 44 px button with a name. */
export function SelectionBar({ count, total, allFavorite, onFavorite, onFinished, onShelf, onDetails, onDelete, onSelectAll, onDone }: SelectionBarProps) {
  return (
    <div className="pn-lib-selbar" role="toolbar" aria-label="Actions for selected books">
      <Button variant="ghost" iconOnly icon="close" aria-label="Done selecting" onClick={onDone} />
      <span className="pn-lib-selbar__count" aria-live="polite">
        {count === 0 ? 'Select books' : `${count} selected`}
      </span>
      {count < total ? (
        <Button variant="ghost" aria-label="Select all" onClick={onSelectAll}>
          All
        </Button>
      ) : null}
      <span className="pn-lib-selbar__spacer" />
      <button type="button" className="pn-btn pn-btn--ghost pn-btn--icon" aria-label={allFavorite ? 'Remove from favorites' : 'Add to favorites'} disabled={count === 0} onClick={onFavorite}>
        <Icon name="heart" filled={allFavorite} />
      </button>
      <button type="button" className="pn-btn pn-btn--ghost pn-btn--icon" aria-label="Mark as finished or not finished" disabled={count === 0} onClick={onFinished}>
        <Icon name="circleCheck" />
      </button>
      <Button variant="ghost" iconOnly icon="collections" aria-label="Add to a collection" disabled={count === 0} onClick={onShelf} />
      {onDetails ? (
        <button type="button" className="pn-btn pn-btn--ghost pn-btn--icon" aria-label="Edit details" onClick={onDetails}>
          <Icon name="pencil" />
        </button>
      ) : null}
      <button type="button" className="pn-btn pn-btn--ghost pn-btn--icon" aria-label="Delete" disabled={count === 0} onClick={onDelete}>
        <Icon name="trash" />
      </button>
    </div>
  );
}
