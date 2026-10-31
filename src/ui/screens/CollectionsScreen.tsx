import { useId, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Illustration } from '../components/Illustration';
import { OverflowMenu, type OverflowMenuItem } from '../components/OverflowMenu';
import { Skeleton, SkeletonGroup } from '../components/Skeleton';
import { Icon } from '../icons';
import { DEFAULT_SMART_COLLECTIONS, type CollectionShelf, type SmartCollection } from './collectionsOptions';
import '../styles/screens.css';
import '../styles/surfaces.css';

export interface CollectionsScreenProps {
  /** The shelves the person made, in their order. */
  shelves: readonly CollectionShelf[];
  /** Skeleton rows instead of the list while shelves load. */
  loading?: boolean;
  /** Automatic shelves above the list. Default: Unfinished and Recently added. Pass `[]` to hide the section. */
  smart?: readonly SmartCollection[];
  onOpenShelf: (shelf: CollectionShelf) => void;
  onOpenSmart?: (smart: SmartCollection) => void;
  /** Starts a new collection. Without it there is no New button anywhere on the screen. */
  onCreate?: () => void;
  /** Row actions live in a "⋯" menu per shelf. Leave one out and its item is not offered. */
  onRename?: (shelf: CollectionShelf) => void;
  onDelete?: (shelf: CollectionShelf) => void;
  /** -1 moves up, 1 moves down. The first shelf has no "Move up" and the last no "Move down". */
  onMove?: (shelf: CollectionShelf, direction: -1 | 1) => void;
  /** Plain-word error shown above the lists (see ErrorNotice). */
  notice?: ReactNode;
  /** Extra actions in the empty state next to "Make a collection". */
  emptyActions?: ReactNode;
  /** Number of skeleton rows while loading. */
  skeletonCount?: number;
}

const plural = (n: number): string => `${n} ${n === 1 ? 'book' : 'books'}`;

/** Little collage of up to four covers, or a shelf icon. Decorative. */
function ShelfArt({ covers }: { covers?: readonly string[] }) {
  const shown = (covers ?? []).filter(Boolean).slice(0, 4);
  if (shown.length === 0) {
    return (
      <span className="pn-shelf__art pn-shelf__art--icon" aria-hidden="true">
        <Icon name="collections" size={24} />
      </span>
    );
  }
  return (
    <span className={`pn-shelf__art pn-shelf__art--${shown.length === 1 ? 'one' : 'many'}`} aria-hidden="true">
      {shown.map((src, i) => (
        <img key={`${i}-${src}`} className="pn-shelf__cover" src={src} alt="" width={40} height={60} loading="lazy" decoding="async" draggable={false} />
      ))}
    </span>
  );
}

/**
 * Collections (blueprint 5.6): the two automatic shelves, then your own, each with a cover collage, its name and how
 * many books it holds. Rename, reorder and delete sit in one "⋯" menu per shelf, so a row stays calm and every action
 * still has a 44 px target and a keyboard path. Presentational: the app owns the data and every handler.
 */
export function CollectionsScreen({
  shelves,
  loading = false,
  smart = DEFAULT_SMART_COLLECTIONS,
  onOpenShelf,
  onOpenSmart,
  onCreate,
  onRename,
  onDelete,
  onMove,
  notice,
  emptyActions,
  skeletonCount = 3,
}: CollectionsScreenProps) {
  const smartId = useId();
  const mineId = useId();
  const empty = !loading && shelves.length === 0;
  const menuFor = (shelf: CollectionShelf, index: number): OverflowMenuItem[] => {
    const items: OverflowMenuItem[] = [];
    if (onRename) items.push({ label: 'Rename', icon: 'pencil', onSelect: () => onRename(shelf) });
    if (onMove && index > 0) items.push({ label: 'Move up', icon: 'chevronUp', onSelect: () => onMove(shelf, -1) });
    if (onMove && index < shelves.length - 1) items.push({ label: 'Move down', icon: 'chevronDown', onSelect: () => onMove(shelf, 1) });
    if (onDelete) items.push({ label: 'Delete collection', icon: 'trash', danger: true, onSelect: () => onDelete(shelf) });
    return items;
  };
  return (
    <div className="pn-screen pn-collections">
      <header className="pn-screen__header">
        <h1 className="pn-screen__title">Collections</h1>
        {onCreate ? (
          <Button icon="plus" onClick={onCreate}>
            New collection
          </Button>
        ) : null}
      </header>

      {notice}

      {smart.length > 0 ? (
        <section aria-labelledby={smartId} className="pn-collections__section">
          <h2 id={smartId} className="pn-section-title">
            Automatic
          </h2>
          <ul className="pn-shelves">
            {smart.map((s) => (
              <li key={s.id}>
                <Card className="pn-shelf" onPress={() => onOpenSmart?.(s)}>
                  <span className="pn-shelf__art pn-shelf__art--icon pn-shelf__art--smart" aria-hidden="true">
                    <Icon name={s.icon ?? 'collections'} size={24} />
                  </span>
                  <span className="pn-shelf__text">
                    <span className="pn-shelf__name">{s.name}</span>
                    <span className="pn-shelf__sub">{s.description}</span>
                  </span>
                  <Icon name="chevronRight" size={20} className="pn-shelf__chevron" aria-hidden="true" />
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby={mineId} className="pn-collections__section">
        <h2 id={mineId} className="pn-section-title">
          Your collections
        </h2>
        {loading ? (
          <SkeletonGroup label="Loading your collections" className="pn-shelves">
            {Array.from({ length: skeletonCount }, (_, i) => (
              <div key={i} className="pn-shelf pn-shelf--skeleton" aria-hidden="true">
                <Skeleton variant="rect" className="pn-shelf__art" />
                <span className="pn-shelf__text">
                  <Skeleton variant="text" width="50%" />
                  <Skeleton variant="text" width="25%" />
                </span>
              </div>
            ))}
          </SkeletonGroup>
        ) : empty ? (
          <EmptyState
            art={<Illustration name="shelf" />}
            title="No collections yet"
            description="Group books your own way, like “Summer reading” or “Bedtime stories”."
            action={onCreate ? { label: 'Make a collection', icon: 'plus', onClick: onCreate } : undefined}
            extra={emptyActions}
            headingLevel={3}
          />
        ) : (
          <ul className="pn-shelves" aria-label="Your collections">
            {shelves.map((shelf, index) => {
              const items = menuFor(shelf, index);
              return (
                <li key={shelf.id} className="pn-shelves__row">
                  <Card className="pn-shelf" onPress={() => onOpenShelf(shelf)} aria-label={`${shelf.name}, ${plural(shelf.bookCount)}`}>
                    <ShelfArt covers={shelf.covers} />
                    <span className="pn-shelf__text" aria-hidden="true">
                      <span className="pn-shelf__name">{shelf.name}</span>
                      <span className="pn-shelf__sub">{plural(shelf.bookCount)}</span>
                    </span>
                  </Card>
                  {items.length > 0 ? <OverflowMenu label={`Options for ${shelf.name}`} placement="down" items={items} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default CollectionsScreen;
