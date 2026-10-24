import { useLiveQuery } from 'dexie-react-hooks';
import { memo, useState, type FormEvent } from 'react';
import { newId } from '@/data/db';
import { Button, EmptyState, Illustration } from '@/ui';
import { PageHeader, Screen } from '../components/PageHeader';
import { useServices } from '../services-context';
import '../screen-styles';

const ShelfRow = memo(function ShelfRow({ name, count }: { name: string; count: number }) {
  return (
    <li className="flex min-h-touch items-center justify-between rounded-card bg-surface px-4 py-3">
      <span className="font-semibold">{name}</span>
      <span className="text-sm text-muted">{count === 1 ? '1 book' : `${count} books`}</span>
    </li>
  );
});

/** Shelves. Creating and listing shelves works today; adding books to them comes with the library import. */
export function CollectionsPage() {
  const { db } = useServices();
  const [name, setName] = useState('');
  const shelves = useLiveQuery(async () => {
    const [all, memberships] = await Promise.all([
      db.collections.orderBy('order').toArray(),
      // One keys-only pass over the index instead of one count query per shelf.
      db.collectionBooks.orderBy('collectionId').keys(),
    ]);
    const counts = new Map<string, number>();
    for (const id of memberships) counts.set(String(id), (counts.get(String(id)) ?? 0) + 1);
    return all.map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }));
  }, [db]);

  async function createShelf(event: FormEvent): Promise<void> {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const last = await db.collections.orderBy('order').last();
    await db.collections.add({ id: newId(), name: trimmed, order: (last?.order ?? -1) + 1 });
    setName('');
  }

  const form = (
    <form onSubmit={(e) => void createShelf(e)} className="flex w-full max-w-sm gap-2">
      <label className="sr-only" htmlFor="shelf-name">
        Shelf name
      </label>
      <input
        id="shelf-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name your first shelf"
        maxLength={60}
        className="min-h-touch min-w-0 flex-1 rounded-full border-2 border-[rgb(var(--pn-border-strong))] bg-surface px-4 text-ink placeholder:text-muted"
      />
      <Button type="submit">Add shelf</Button>
    </form>
  );

  return (
    <Screen>
      <PageHeader title="Collections" />
      {shelves === undefined ? null : shelves.length === 0 ? (
        <>
          <EmptyState
            art={<Illustration name="shelf" />}
            title="No shelves yet"
            description="Shelves group your books, like Favorites or Summer reading. Make one to get started."
          />
          <div className="flex justify-center">{form}</div>
        </>
      ) : (
        <>
          <ul className="mb-4 flex flex-col gap-3">
            {shelves.map((shelf) => (
              <ShelfRow key={shelf.id} name={shelf.name} count={shelf.count} />
            ))}
          </ul>
          {form}
        </>
      )}
    </Screen>
  );
}
