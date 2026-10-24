import { useCallback, useEffect, useState } from 'react';
import { LibraryScreen } from '@/features/library';
import { useNavigate } from 'react-router-dom';
import type { CollectionSummary } from '@/data/collections';
import type { LibraryQuery } from '@/data/library-query';
import { useSnackbar } from '@/ui';
import {
  CollectionBooksEmpty,
  CollectionNameSheet,
  CollectionsScreen,
  DEFAULT_SMART_COLLECTIONS,
  type CollectionShelf,
  type SmartCollection,
} from '@/ui/screens';
import { useLibraryRevision } from '../library-hooks';
import { Screen } from '../components/PageHeader';
import { useServices } from '../services-context';
import '../screen-styles';

type Opened = { name: string; shelfId?: string; preset?: Partial<LibraryQuery>; empty?: boolean };

/** The two automatic shelves and the Library filters they open. */
const SMART_PRESETS: Readonly<Record<string, Partial<LibraryQuery>>> = {
  unfinished: { status: 'unfinished', sort: 'recent' },
  recent: { sort: 'added' },
};

/**
 * Collections (route `/collections`): the design system's `CollectionsScreen` (two automatic shelves,
 * then your own, one "⋯" menu per shelf) and `CollectionNameSheet` bound to the data layer
 * (`data.collections`). An opened shelf is the Library's `LibraryScreen` filtered to it (or
 * `CollectionBooksEmpty` while it is empty). Delete keeps its Undo snackbar.
 */
export function CollectionsPage() {
  const { data } = useServices();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const revision = useLibraryRevision();
  const [shelves, setShelves] = useState<CollectionSummary[] | undefined>();
  const [opened, setOpened] = useState<Opened | undefined>();
  const [naming, setNaming] = useState<{ id?: string; name: string } | undefined>();
  const [problem, setProblem] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();

  const load = useCallback(async () => {
    try {
      setShelves(await data.collections.list());
      setNotice(undefined);
    } catch {
      setShelves((current) => current ?? []);
      setNotice('Your collections could not be read just now. Please try again.');
    }
  }, [data]);
  useEffect(() => {
    if (revision !== undefined) void load();
  }, [revision, load]);

  const move = async (shelf: CollectionShelf, by: -1 | 1): Promise<void> => {
    if (!shelves) return;
    const order = shelves.map((s) => s.id);
    const index = order.indexOf(shelf.id);
    const target = index + by;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target] as string, order[index] as string];
    setShelves(order.map((id) => shelves.find((s) => s.id === id) as CollectionSummary));
    try {
      await data.collections.reorder(order);
    } catch {
      void load();
    }
  };

  const save = async (): Promise<void> => {
    if (!naming || busy) return;
    setBusy(true);
    try {
      if (naming.id) await data.collections.rename(naming.id, naming.name);
      else await data.collections.create(naming.name);
      setNaming(undefined);
      setProblem(undefined);
      void load();
    } catch (error) {
      setProblem(error instanceof Error && error.message ? error.message : 'That could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (shelf: CollectionShelf): Promise<void> => {
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

  const closeNaming = (): void => {
    setNaming(undefined);
    setProblem(undefined);
  };

  if (opened) {
    return (
      <Screen>
        {opened.empty ? (
          <CollectionBooksEmpty name={opened.name} action={{ label: 'Go to your library', icon: 'library', onClick: () => navigate('/') }} />
        ) : (
          <LibraryScreen
            title={opened.name}
            onBack={() => setOpened(undefined)}
            {...(opened.shelfId ? { shelfId: opened.shelfId } : {})}
            {...(opened.preset ? { preset: opened.preset } : {})}
          />
        )}
      </Screen>
    );
  }

  return (
    <>
      <CollectionsScreen
        shelves={shelves ?? []}
        loading={shelves === undefined}
        smart={DEFAULT_SMART_COLLECTIONS}
        onOpenShelf={(shelf) => setOpened({ name: shelf.name, shelfId: shelf.id, empty: shelf.bookCount === 0 })}
        onOpenSmart={(smart: SmartCollection) => {
          const preset = SMART_PRESETS[smart.id];
          setOpened({ name: smart.name, ...(preset ? { preset } : {}) });
        }}
        onCreate={() => setNaming({ name: '' })}
        onRename={(shelf) => setNaming({ id: shelf.id, name: shelf.name })}
        onDelete={(shelf) => void remove(shelf)}
        onMove={(shelf, direction) => void move(shelf, direction)}
        {...(notice ? { notice: <p role="alert">{notice}</p> } : {})}
      />
      <CollectionNameSheet
        open={naming !== undefined}
        mode={naming?.id ? 'rename' : 'create'}
        name={naming?.name ?? ''}
        onNameChange={(name) => setNaming((n) => (n ? { ...n, name } : n))}
        onSubmit={() => void save()}
        onClose={closeNaming}
        busy={busy}
        {...(problem ? { error: problem } : {})}
      />
    </>
  );
}
