import { Icon } from '../icons';
import { cx } from '../utils/cx';

/**
 * Small heart in the bottom-left corner of a cover. Absolutely positioned inside the cover box, so it never moves
 * the layout. Named "Favorite" for assistive tech. Colors come from the inverse tokens, which are AA in every theme
 * (and in high contrast), and it is a different shape and corner from the headphone badge.
 */
export function FavoriteBadge({ className }: { className?: string }) {
  return (
    <span className={cx('pn-bookcard__badge', 'pn-bookcard__badge--favorite', className)} role="img" aria-label="Favorite">
      <Icon name="heart" size={16} filled />
    </span>
  );
}
