import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { newId } from '@/data/db';
import { Button, EmptyState } from '@/ui';
import { PageHeader } from '../components/PageHeader';
import { useServices } from '../services-context';

/** Shelves. Creating and listing shelves works today; adding books to them comes with the library import. */
export function CollectionsPage() {
  const { db } = useServices();
  const [name, setName] = useState('');
  const shelves = useLiveQuery(async () => {
    const all = await db.collections.orderBy('order').toArray();
    return Promise.all(
      all.map(async (c) => ({ ...c, count: await db.collectionBooks.where('collectionId').equals(c.id).count() })),
    );
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
    <>
      <PageHeader title="Collections" />
      {shelves === undefined ? null : shelves.length === 0 ? (
        <>
          <EmptyState
            art="collections"
            title="No shelves yet"
            description="Shelves group your books, like Favorites or Summer reading. Make one to get started."
          />
          <div className="flex justify-center">{form}</div>
        </>
      ) : (
        <>
          <ul className="mb-4 flex flex-col gap-3">
            {shelves.map((shelf) => (
              <li key={shelf.id} className="flex min-h-touch items-center justify-between rounded-card bg-surface px-4 py-3">
                <span className="font-medium">{shelf.name}</span>
                <span className="text-sm text-muted">{shelf.count === 1 ? '1 book' : `${shelf.count} books`}</span>
              </li>
            ))}
          </ul>
          {form}
        </>
      )}
    </>
  );
}
