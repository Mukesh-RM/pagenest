import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataClient } from '@/data/data-client';
import type { LibraryPage as LibraryPageData } from '@/data/library-query';
import { bookRecord } from '@/data/test-fixtures';
import { useCoverUrl, useCoverUrls, useLibraryPage } from './library-hooks';
import { LibraryPage } from './pages/LibraryPage';
import { SnackbarProvider } from '@/ui';
import { setSetting } from '@/data/settings';
import type { BookImporter } from './contracts';
import { renderApp, resetSettings } from './test-utils';
import { ServicesContext, type AppServices } from './services-context';
import { makeServices } from './test-utils';

let services: AppServices;
beforeEach(() => {
  services = makeServices('library-page');
});
afterEach(async () => {
  services.covers.dispose();
  services.data.close();
  services.db.close();
  await services.db.delete();
});

const wrapper =
  (value: AppServices) =>
  ({ children }: { children: ReactNode }) => <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;

function page(titles: string[]): LibraryPageData {
  return { total: titles.length, items: titles.map((t, i) => ({ ...bookRecord(`id${i}-${t}`, { title: t }), percent: 0 })) };
}

/** A data client whose library.query is controlled by the test. */
function withQuery(query: DataClient['library']['query']): AppServices {
  const data = { ...services.data, library: { ...services.data.library, query } } as DataClient;
  return { ...services, data };
}

describe('LibraryPage with the data layer (design system LibraryScreen)', () => {
  function renderLibrary(value: AppServices = services) {
    return render(
      <ServicesContext.Provider value={value}>
        <MemoryRouter>
          <SnackbarProvider>
            <LibraryPage />
          </SnackbarProvider>
        </MemoryRouter>
      </ServicesContext.Provider>,
    );
  }
  const cards = () => within(screen.getByRole('list', { name: 'Books' })).getAllByRole('button');

  it('shows books from the worker query as cards with progress, newest first', async () => {
    await services.db.books.bulkAdd([bookRecord('old', { title: 'Older', addedAt: 1 }), bookRecord('new', { title: 'Newer', addedAt: 2 })]);
    await services.db.progress.put({
      bookId: 'old',
      mode: 'read',
      locator: { kind: 'reflow', section: 0, textOffset: 1 },
      percent: 42.4,
      updatedAt: 5,
    });
    renderLibrary();
    await screen.findByRole('list', { name: 'Books' });
    await waitFor(() => expect(cards()).toHaveLength(2));
    expect(cards().map((c) => c.getAttribute('aria-label'))).toEqual(['Newer. Not started', 'Older. 42% read']);
  });

  it('uses the design system page title (serif token) and one search field', async () => {
    renderLibrary();
    const title = await screen.findByRole('heading', {
      level: 1,
      name: 'Library',
    });
    expect(title).toHaveClass('pn-screen__title');
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);
  });

  it('shows a book added later without reloading', async () => {
    renderLibrary();
    await screen.findByText('Your library is empty');
    await services.data.books.add({
      fingerprint: 'f1',
      kind: 'ebook',
      format: 'epub',
      title: 'Arrived',
      file: new Blob(['x']),
      fileName: 'a.epub',
    });
    await screen.findAllByText('Arrived');
    expect(screen.queryByText('Your library is empty')).toBeNull();
  });

  it('does not read the whole progress table to draw a plain list', async () => {
    const progressToArray = vi.spyOn(services.db.progress, 'toArray');
    await services.db.books.bulkAdd([bookRecord('a'), bookRecord('b')]);
    renderLibrary();
    await screen.findAllByText('Title a');
    expect(progressToArray).not.toHaveBeenCalled();
  });

  it('asks the worker for one capped page, never the whole table', async () => {
    const query = vi.fn(async () => page(['x']));
    renderLibrary(withQuery(query as DataClient['library']['query']));
    await screen.findAllByText('x');
    expect(query).toHaveBeenCalledWith({ limit: 500 });
  });

  it('typing in the search box and choosing a chip ask the worker for exactly that', async () => {
    const query = vi.fn(async () => page(['x']));
    renderLibrary(withQuery(query as DataClient['library']['query']));
    await screen.findAllByText('x');
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: ' dune ' },
    });
    await waitFor(() => expect(query).toHaveBeenLastCalledWith({ limit: 500, text: 'dune' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finished' }));
    await waitFor(() =>
      expect(query).toHaveBeenLastCalledWith({
        limit: 500,
        text: 'dune',
        status: 'finished',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    await waitFor(() => expect(query).toHaveBeenLastCalledWith({ limit: 500 }));
  });

  it('says so when a search finds nothing (not the empty-library message)', async () => {
    const query = vi.fn(async (q: { text?: string }) => (q.text ? page([]) : page(['x'])));
    renderLibrary(withQuery(query as DataClient['library']['query']));
    await screen.findAllByText('x');
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'zzz' },
    });
    expect(await screen.findByText('No books match that search')).toBeInTheDocument();
    expect(screen.queryByText('Your library is empty')).toBeNull();
  });

  describe('covers', () => {
    const created: string[] = [];
    const revoked: string[] = [];
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    beforeEach(() => {
      created.length = 0;
      revoked.length = 0;
      URL.createObjectURL = () => {
        const url = `blob:cover-${created.length + 1}`;
        created.push(url);
        return url;
      };
      URL.revokeObjectURL = (u) => void revoked.push(u);
    });
    afterEach(() => {
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    });

    it('shows a stored cover and gives the URL back when the screen goes away', async () => {
      await services.data.books.add({
        fingerprint: 'f1',
        kind: 'ebook',
        format: 'epub',
        title: 'With cover',
        file: new Blob(['x']),
        fileName: 'a.epub',
        cover: new Blob(['img']),
      });
      const view = renderLibrary();
      await waitFor(() => expect(view.container.querySelector('img')).toHaveAttribute('src', 'blob:cover-1'));
      expect(created).toHaveLength(1);
      view.unmount();
      services.covers.dispose();
      expect(revoked).toEqual(['blob:cover-1']);
    });

    it('draws a title card, not an image, for a book without a cover', async () => {
      await services.db.books.add(bookRecord('plain'));
      const view = renderLibrary();
      await screen.findAllByText('Title plain');
      expect(view.container.querySelector('img')).toBeNull();
      expect(created).toEqual([]);
    });
  });
});

describe('Library actions', () => {
  beforeEach(() => {
    resetSettings();
    localStorage.clear();
  });

  async function launch(extra: Partial<AppServices> = {}): Promise<AppServices> {
    const value = { ...services, ...extra };
    await setSetting(value.db, 'onboardingDone', true);
    return value;
  }

  it('tapping a card opens the detail sheet, and Start reading opens the reader', async () => {
    const value = await launch();
    await value.db.books.add(bookRecord('b1', { title: 'The Long Road' }));
    renderApp(value);
    fireEvent.click(await screen.findByRole('button', { name: /^The Long Road/ }));
    const sheet = await screen.findByRole('dialog', { name: 'The Long Road' });
    expect(within(sheet).queryByRole('button', { name: /Listen/ })).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Start reading' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Long Road' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to library' })).toBeInTheDocument();
  });

  it('an audiobook offers Listen (not Read) and opens the player route', async () => {
    const value = await launch();
    await value.db.books.add(bookRecord('a1', { title: 'Spoken', kind: 'audio', format: 'm4b' }));
    renderApp(value);
    fireEvent.click(await screen.findByRole('button', { name: /^Spoken/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Spoken' });
    expect(within(sheet).queryByRole('button', { name: /reading/ })).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Listen' }));
    expect(await screen.findByRole('link', { name: 'Back to Library' })).toBeInTheDocument();
  });

  it('Remove asks first, removes the book with an Undo, and Undo brings it back', async () => {
    const value = await launch();
    await value.db.books.add(bookRecord('b1', { title: 'Doomed' }));
    renderApp(value);
    fireEvent.click(await screen.findByRole('button', { name: /^Doomed/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove from library' }));
    const confirm = await screen.findByRole('dialog', {
      name: 'Remove this book?',
    });
    expect(await screen.findByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(await value.db.books.count()).toBe(1); // nothing is removed until confirmed
    fireEvent.click(within(confirm).getByRole('button', { name: 'Remove' }));
    await waitFor(async () => expect(await value.db.books.count()).toBe(0));
    expect(await screen.findByText('Removed “Doomed”.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect(await value.db.books.count()).toBe(1));
    expect((await screen.findAllByText('Doomed')).length).toBeGreaterThan(0);
  });

  it('Cancel in the confirmation keeps the book', async () => {
    const value = await launch();
    await value.db.books.add(bookRecord('b1', { title: 'Safe' }));
    renderApp(value);
    fireEvent.click(await screen.findByRole('button', { name: /^Safe/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove from library' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Remove this book?' })).toBeNull());
    expect(await value.db.books.count()).toBe(1);
  });

  it('Add books says plainly that adding is not available when no importer is registered (no dead button)', async () => {
    const value = await launch();
    renderApp(value);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add books' }))[0] as HTMLElement);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Adding books is not ready yet');
    fireEvent.click(within(alert).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Add books opens the file picker for a registered importer and reports what it added', async () => {
    const importer: BookImporter = {
      accept: '.epub,.pdf',
      available: () => true,
      importFiles: vi.fn(async (files: readonly File[]) =>
        files.map((f) => ({
          fileName: f.name,
          result: {
            bookId: 'n',
            kind: 'ebook' as const,
            format: 'epub' as const,
            title: 'N',
            alreadyInLibrary: false,
          },
        })),
      ),
    };
    const value = await launch({ importer });
    const { container } = renderApp(value);
    await screen.findAllByRole('button', { name: 'Add books' });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toHaveAttribute('accept', '.epub,.pdf');
    const click = vi.spyOn(input as HTMLInputElement, 'click');
    fireEvent.click(screen.getAllByRole('button', { name: 'Add books' })[0] as HTMLElement);
    expect(click).toHaveBeenCalledTimes(1);
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['x'], 'a.epub'), new File(['y'], 'b.epub')] },
    });
    expect(await screen.findByText('Added 2 books to your library.')).toBeInTheDocument();
    expect(importer.importFiles).toHaveBeenCalledTimes(1);
  });

  it("shows the importer's plain-words error for a file that could not be added", async () => {
    const importer: BookImporter = {
      accept: '.epub',
      available: () => true,
      importFiles: async (files) =>
        files.map((f) => ({
          fileName: f.name,
          error: 'This file is protected by DRM, so PageNest cannot open it.',
        })),
    };
    const value = await launch({ importer });
    const { container } = renderApp(value);
    await screen.findAllByRole('button', { name: 'Add books' });
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [new File(['x'], 'a.epub')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('protected by DRM');
  });

  it('Not now hides the Welcome back card for this visit', async () => {
    const value = await launch();
    await value.db.books.add(bookRecord('b1', { title: 'Midway' }));
    await value.progress.save('b1', 'read', { kind: 'reflow', section: 1, textOffset: 0 }, 30);
    renderApp(value);
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Welcome back' })).toBeNull());
  });
});

describe('useLibraryPage', () => {
  it('keeps the previous page on screen while the next loads, and drops answers that arrive late', async () => {
    const pending: Array<{ text: string | undefined; resolve: (p: LibraryPageData) => void }> = [];
    const query = vi.fn(
      (q: { text?: string }) =>
        new Promise<LibraryPageData>((resolve) => {
          pending.push({ text: q.text, resolve });
        }),
    );
    const { result, rerender } = renderHook(({ text }) => useLibraryPage({ text }), {
      initialProps: { text: 'a' },
      wrapper: wrapper(withQuery(query as DataClient['library']['query'])),
    });
    await waitFor(() => expect(pending).toHaveLength(1));
    await act(async () => pending[0]?.resolve(page(['First answer'])));
    await waitFor(() => expect(result.current.page?.items[0]?.title).toBe('First answer'));

    rerender({ text: 'ab' });
    rerender({ text: 'abc' });
    await waitFor(() => expect(pending).toHaveLength(3));
    expect(result.current.page?.items[0]?.title).toBe('First answer'); // no flash of empty

    await act(async () => pending[2]?.resolve(page(['Answer for abc'])));
    await act(async () => pending[1]?.resolve(page(['Late answer for ab'])));
    await waitFor(() => expect(result.current.page?.items[0]?.title).toBe('Answer for abc'));
    expect(result.current.error).toBeUndefined();
  });

  it('does not run the query again for an equal inline query object', async () => {
    const query = vi.fn(async () => page([]));
    const { rerender } = renderHook(() => useLibraryPage({ text: 'x', limit: 5 }), {
      wrapper: wrapper(withQuery(query as DataClient['library']['query'])),
    });
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1));
    rerender();
    rerender();
    await new Promise((r) => setTimeout(r, 30));
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('reports a failure and keeps the last good page', async () => {
    let fail = false;
    const query = vi.fn(async () => {
      if (fail) throw new Error('worker went away');
      return page(['Good']);
    });
    const value = withQuery(query as DataClient['library']['query']);
    const { result } = renderHook(() => useLibraryPage({}), { wrapper: wrapper(value) });
    await waitFor(() => expect(result.current.page?.items).toHaveLength(1));
    fail = true;
    await act(async () => {
      await value.db.books.add(bookRecord('x'));
    });
    await waitFor(() => expect(result.current.error?.message).toBe('worker went away'));
    expect(result.current.page?.items[0]?.title).toBe('Good');
  });

  it('refreshes when a book changes', async () => {
    const { result } = renderHook(() => useLibraryPage({ sort: 'title' }), { wrapper: wrapper(services) });
    await waitFor(() => expect(result.current.page?.total).toBe(0));
    await act(async () => {
      await services.db.books.add(bookRecord('x', { title: 'Zed' }));
    });
    await waitFor(() => expect(result.current.page?.items.map((b) => b.title)).toEqual(['Zed']));
    await act(async () => {
      await services.db.progress.put({
        bookId: 'x',
        mode: 'read',
        locator: { kind: 'reflow', section: 0, textOffset: 0 },
        percent: 30,
        updatedAt: 1,
      });
    });
    await waitFor(() => expect(result.current.page?.items[0]?.percent).toBe(30));
  });
});

describe('useCoverUrl', () => {
  it('releases a lease that arrives after the component left', async () => {
    let finish: (b: Blob) => void = () => {};
    const revoke = vi.fn();
    const created = vi.fn(() => 'blob:late');
    const { CoverUrlCache } = await import('@/data/cover-url');
    const covers = new CoverUrlCache({
      load: () => new Promise<Blob>((r) => (finish = r)),
      createObjectURL: created,
      revokeObjectURL: revoke,
      maxIdle: 0,
    });
    const value = { ...services, covers };
    const { result, unmount } = renderHook(() => useCoverUrl('b', true), { wrapper: wrapper(value) });
    expect(result.current).toBeUndefined();
    unmount();
    finish(new Blob(['x']));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:late')); // lease released straight away, nothing kept alive
    expect(covers.size).toBe(0);
  });

  it('gives nothing for a book without a cover', () => {
    const { result } = renderHook(() => useCoverUrl('b', false), { wrapper: wrapper(services) });
    expect(result.current).toBeUndefined();
  });
});

describe('useCoverUrls', () => {
  const wrapperFor = (value: AppServices) => wrapper(value);
  it('gives one URL per book with a cover, keeps them while the books stay, and releases them on unmount', async () => {
    const acquired: string[] = [];
    const released: string[] = [];
    const covers = {
      acquire: vi.fn(async (id: string) => {
        acquired.push(id);
        return { url: `blob:${id}`, release: () => void released.push(id) };
      }),
    } as unknown as AppServices['covers'];
    const value = { ...services, covers };
    const withCover = { id: 'a', coverRef: { store: 'x' } };
    const without = { id: 'b' };
    const { result, rerender, unmount } = renderHook(({ books }) => useCoverUrls(books), {
      initialProps: {
        books: [withCover, without] as readonly {
          id: string;
          coverRef?: unknown;
        }[],
      },
      wrapper: wrapperFor(value),
    });
    await waitFor(() => expect(result.current).toEqual({ a: 'blob:a' }));
    rerender({ books: [withCover, without] }); // same ids, new array: nothing is asked again
    expect(acquired).toEqual(['a']);
    rerender({ books: [without] }); // the book left the list: its lease is given back
    await waitFor(() => expect(released).toEqual(['a']));
    expect(result.current).toEqual({});
    rerender({ books: [withCover] });
    await waitFor(() => expect(result.current).toEqual({ a: 'blob:a' }));
    unmount();
    expect(released).toEqual(['a', 'a']);
  });
});
