import { useCallback, useEffect, useId, useState } from 'react';
import { useServices } from '@/app/services-context';
import type { CollectionSummary } from '@/data/collections';
import { BottomSheet, Button, Icon } from '@/ui';

export interface ShelfSheetProps {
  open: boolean;
  bookIds: readonly string[];
  onClose: () => void;
  /** Tell the person what happened ("Added 3 books to Sci-fi"). */
  onDone: (message: string) => void;
}

const plural = (n: number): string => `${n} ${n === 1 ? 'book' : 'books'}`;

/** "Add to a collection": tap a shelf to add the selected books, or make a new shelf. */
export function ShelfSheet({ open, bookIds, onClose, onDone }: ShelfSheetProps) {
  const { data } = useServices();
  const nameId = useId();
  const [shelves, setShelves] = useState<CollectionSummary[]>([]);
  const [on, setOn] = useState<ReadonlySet<string>>(new Set());
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | undefined>();
  const single = bookIds.length === 1 ? (bookIds[0] as string) : undefined;

  const load = useCallback(async () => {
    setShelves(await data.collections.list());
    if (single) setOn(new Set((await data.collections.shelvesOf(single)).map((s) => s.id)));
  }, [data, single]);
  useEffect(() => {
    if (open) {
      setName('');
      setProblem(undefined);
      void load();
    }
  }, [open, load]);

  async function toggle(shelf: CollectionSummary): Promise<void> {
    try {
      if (single && on.has(shelf.id)) {
        await data.collections.removeBooks(shelf.id, [single]);
        onDone(`Removed from ${shelf.name}`);
      } else {
        const r = await data.collections.addBooks(shelf.id, [...bookIds]);
        onDone(r.added.length > 0 ? `Added ${plural(r.added.length)} to ${shelf.name}` : `Already on ${shelf.name}`);
      }
      onClose();
    } catch {
      setProblem('That could not be saved. Please try again.');
    }
  }
  async function create(): Promise<void> {
    try {
      const shelf = await data.collections.create(name);
      await data.collections.addBooks(shelf.id, [...bookIds]);
      onDone(`Added ${plural(bookIds.length)} to ${shelf.name}`);
      onClose();
    } catch (error) {
      setProblem(error instanceof Error && error.message ? error.message : 'That shelf could not be made. Please try again.');
    }
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Add to a collection">
      {shelves.length === 0 ? <p className="pn-lib-sheet-note">You have no collections yet. Name your first one below.</p> : null}
      <ul className="pn-lib-shelfpick">
        {shelves.map((s) => (
          <li key={s.id}>
            <button type="button" className="pn-lib-shelfpick__btn" onClick={() => void toggle(s)} aria-pressed={single ? on.has(s.id) : undefined}>
              <span>{s.name}</span>
              <span className="pn-lib-sub">{single && on.has(s.id) ? <Icon name="check" size={20} label="On this shelf" /> : plural(s.bookCount)}</span>
            </button>
          </li>
        ))}
      </ul>
      <form
        className="pn-lib-form"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label htmlFor={nameId}>New collection</label>
        <input id={nameId} className="pn-lib-field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="For example, Summer reading" />
        {problem ? (
          <p role="alert" className="pn-lib-error">
            {problem}
          </p>
        ) : null}
        <Button type="submit" block variant="secondary" disabled={name.trim() === ''}>
          Make it and add
        </Button>
      </form>
    </BottomSheet>
  );
}
