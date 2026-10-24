import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { PageHeader } from '@/app/components/PageHeader';
import { useLibraryRevision } from '@/app/library-hooks';
import { useServices } from '@/app/services-context';
import type { CollectionSummary } from '@/data/collections';
import type { LibraryQuery } from '@/data/library-query';
import { BottomSheet, Button, Card, EmptyState, SkeletonGroup, SnackbarProvider, useSnackbar } from '@/ui';
import { LibIcon } from '../icons';
import { LibraryScreen } from './LibraryScreen';

type Opened = { name: string; shelfId?: string; preset?: Partial<LibraryQuery> };

const SMART: readonly Opened[] = [
  { name: 'Unfinished', preset: { status: 'unfinished', sort: 'recent' } },
  { name: 'Recently added', preset: { sort: 'added' } },
];

const plural = (n: number): string => `${n} ${n === 1 ? 'book' : 'books'}`;

function Body() {
  const { data } = useServices();
  const snackbar = useSnackbar();
  const revision = useLibraryRevision();
  const nameId = useId();
  const [shelves, setShelves] = useState<CollectionSummary[] | undefined>();
  const [opened, setOpened] = useState<Opened | undefined>();
  const [naming, setNaming] = useState<{ id?: string; name: string } | undefined>();
  const [problem, setProblem] = useState<string | undefined>();

  const load = useCallback(async () => setShelves(await data.collections.list()), [data]);
  useEffect(() => {
    if (revision !== undefined) void load();
  }, [revision, load]);

  const move = async (index: number, by: -1 | 1): Promise<void> => {
    if (!shelves) return;
    const order = shelves.map((s) => s.id);
    const target = index + by;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target] as string, order[index] as string];
    setShelves(order.map((id) => shelves.find((s) => s.id === id) as CollectionSummary));
    try {
      await data.collections.reorder(order);
    } catch {
      void load();
    }
  };

  const save = async (): Promise<void> => {
    if (!naming) return;
    try {
      if (naming.id) await data.collections.rename(naming.id, naming.name);
      else await data.collections.create(naming.name);
      setNaming(undefined);
      setProblem(undefined);
      void load();
    } catch (error) {
      setProblem(error instanceof Error && error.message ? error.message : 'That could not be saved. Please try again.');
    }
  };

  const del = async (shelf: CollectionSummary): Promise<void> => {
    const ids = (await data.collections.booksIn(shelf.id)).map((b) => b.id);
    await data.collections.remove(shelf.id);
    void load();
    snackbar.show({
      message: `${shelf.name} deleted. Its books are still in your library.`,
      onAction: () => {
        void (async () => {
          const again = await data.collections.create(shelf.name);
          if (ids.length > 0) await data.collections.addBooks(again.id, ids);
          void load();
        })();
      },
    });
  };

  const smartShelves = useMemo(() => SMART, []);
  if (opened) {
    return <LibraryScreen title={opened.name} onBack={() => setOpened(undefined)} {...(opened.shelfId ? { shelfId: opened.shelfId } : {})} {...(opened.preset ? { preset: opened.preset } : {})} />;
  }
  return (
    <>
      <PageHeader title="Collections">
        <Button icon="plus" onClick={() => setNaming({ name: '' })}>
          New
        </Button>
      </PageHeader>
      <h2 className="pn-lib-sectiontitle">Automatic</h2>
      <ul className="pn-lib-shelves">
        {smartShelves.map((s) => (
          <li key={s.name}>
            <Card onPress={() => setOpened(s)}>
              <span className="pn-lib-shelfrow__name">{s.name}</span>
              <span className="pn-lib-sub">{s.name === 'Unfinished' ? 'Books you started and have not finished' : 'The newest books first'}</span>
            </Card>
          </li>
        ))}
      </ul>
      <h2 className="pn-lib-sectiontitle">Your collections</h2>
      {shelves === undefined ? (
        <SkeletonGroup label="Loading your collections">
          <span className="pn-skeleton pn-skeleton--rect pn-lib-shelfskel" aria-hidden="true" />
        </SkeletonGroup>
      ) : shelves.length === 0 ? (
        <EmptyState art="collections" title="No collections yet" description="Group books your own way, like Summer reading or Bedtime stories." action={{ label: 'Make a collection', icon: 'plus', onClick: () => setNaming({ name: '' }) }} />
      ) : (
        <ul className="pn-lib-shelves">
          {shelves.map((s, i) => (
            <li key={s.id} className="pn-lib-shelfrow">
              <Card onPress={() => setOpened({ name: s.name, shelfId: s.id })}>
                <span className="pn-lib-shelfrow__name">{s.name}</span>
                <span className="pn-lib-sub">{plural(s.bookCount)}</span>
              </Card>
              <Button variant="ghost" iconOnly icon="chevronUp" aria-label={`Move ${s.name} up`} disabled={i === 0} onClick={() => void move(i, -1)} />
              <Button variant="ghost" iconOnly icon="chevronDown" aria-label={`Move ${s.name} down`} disabled={i === shelves.length - 1} onClick={() => void move(i, 1)} />
              <button type="button" className="pn-btn pn-btn--ghost pn-btn--icon" aria-label={`Rename ${s.name}`} onClick={() => setNaming({ id: s.id, name: s.name })}>
                <LibIcon name="pencil" />
              </button>
              <button type="button" className="pn-btn pn-btn--ghost pn-btn--icon" aria-label={`Delete ${s.name}`} onClick={() => void del(s)}>
                <LibIcon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <BottomSheet open={naming !== undefined} onClose={() => (setNaming(undefined), setProblem(undefined))} title={naming?.id ? 'Rename collection' : 'New collection'}>
        <form
          className="pn-lib-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label htmlFor={nameId}>Name</label>
          <input id={nameId} className="pn-lib-field" value={naming?.name ?? ''} maxLength={60} onChange={(e) => setNaming((n) => (n ? { ...n, name: e.target.value } : n))} aria-invalid={problem !== undefined} />
          {problem ? (
            <p role="alert" className="pn-lib-error">
              {problem}
            </p>
          ) : null}
          <Button type="submit" block disabled={(naming?.name ?? '').trim() === ''}>
            Save
          </Button>
        </form>
      </BottomSheet>
    </>
  );
}

/** Collections: your shelves (make, rename, reorder, delete) and two automatic ones, Unfinished and Recently added. */
export function CollectionsScreen() {
  return (
    <SnackbarProvider>
      <Body />
    </SnackbarProvider>
  );
}
