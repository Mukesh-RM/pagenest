import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type * as HooksModule from './library-hooks';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataClient } from '@/data/data-client';
import type { LibraryPage as LibraryPageData } from '@/data/library-query';
import { bookRecord } from '@/data/test-fixtures';
import { useCoverUrl, useLibraryPage } from './library-hooks';
import { BookCard, LibraryPage } from './pages/LibraryPage';
import { ServicesContext, type AppServices } from './services-context';
import { makeServices } from './test-utils';

// BookCard calls useCoverUrl once per render, so counting those calls counts tile renders.
const cardRenders = vi.hoisted(() => ({ count: 0 }));
vi.mock('./library-hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof HooksModule>();
  return {
    ...actual,
    useCoverUrl: (...args: Parameters<typeof actual.useCoverUrl>) => {
      cardRenders.count += 1;
      return actual.useCoverUrl(...args);
    },
  };
});

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

describe('LibraryPage with the data layer', () => {
  function renderLibrary() {
    return render(
      <ServicesContext.Provider value={services}>
        <MemoryRouter>
          <LibraryPage />
        </MemoryRouter>
      </ServicesContext.Provider>,
    );
  }

  it('shows books from the worker query, with progress, newest first', async () => {
    await services.db.books.bulkAdd([
      bookRecord('old', { title: 'Older', addedAt: 1 }),
      bookRecord('new', { title: 'Newer', addedAt: 2 }),
    ]);
    await services.db.progress.put({ bookId: 'old', mode: 'read', locator: { kind: 'reflow', section: 0, textOffset: 1 }, percent: 42.4, updatedAt: 5 });
    renderLibrary();
    await screen.findByText('Newer');
    const titles = screen.getAllByRole('listitem').map((li) => li.querySelector('p')?.textContent);
    expect(titles).toEqual(['Newer', 'Older']);
    expect(screen.getByRole('progressbar', { name: 'Progress for Older' })).toHaveAttribute('aria-valuenow', '42');
  });

  it('shows a book added later without reloading', async () => {
    renderLibrary();
    await screen.findByText('Your shelf is waiting');
    await services.data.books.add({ fingerprint: 'f1', kind: 'ebook', format: 'epub', title: 'Arrived', file: new Blob(['x']), fileName: 'a.epub' });
    await screen.findByText('Arrived');
    expect(screen.queryByText('Your shelf is waiting')).toBeNull();
  });

  it('does not read the whole progress table to draw a plain list', async () => {
    const progressToArray = vi.spyOn(services.db.progress, 'toArray');
    await services.db.books.bulkAdd([bookRecord('a'), bookRecord('b')]);
    renderLibrary();
    await screen.findByText('Title a');
    expect(progressToArray).not.toHaveBeenCalled();
  });

  it('says plainly when only part of a large library is on screen', async () => {
    await services.db.books.bulkAdd(Array.from({ length: 520 }, (_, i) => bookRecord(`b${i}`, { addedAt: i })));
    renderLibrary();
    await screen.findByText('Showing 500 of 520 books.');
    expect(screen.getAllByRole('listitem')).toHaveLength(500);
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
      await services.data.books.add({ fingerprint: 'f1', kind: 'ebook', format: 'epub', title: 'With cover', file: new Blob(['x']), fileName: 'a.epub', cover: new Blob(['img']) });
      const view = renderLibrary();
      await waitFor(() => expect(view.container.querySelector('img')).toHaveAttribute('src', 'blob:cover-1'));
      expect(created).toHaveLength(1);
      view.unmount();
      services.covers.dispose();
      expect(revoked).toEqual(['blob:cover-1']);
    });

    it('draws no image for a book without a cover', async () => {
      await services.db.books.add(bookRecord('plain'));
      const view = renderLibrary();
      await screen.findByText('Title plain');
      expect(view.container.querySelector('img')).toBeNull();
      expect(created).toEqual([]);
    });
  });
});

describe('BookCard', () => {
  const base = { bookId: 'b', hasCover: false, title: 'T', author: 'A', format: 'epub', percent: 10 };
  const view = (p: typeof base) => (
    <ServicesContext.Provider value={services}>
      <ul>
        <BookCard {...p} />
      </ul>
    </ServicesContext.Provider>
  );

  it('does not render again when its values did not change, only when they do', () => {
    cardRenders.count = 0;
    const result = render(view(base));
    expect(cardRenders.count).toBe(1);
    result.rerender(view({ ...base })); // a new props object with the same values, like every live-query run
    result.rerender(view({ ...base }));
    expect(cardRenders.count).toBe(1);
    result.rerender(view({ ...base, percent: 11 }));
    expect(cardRenders.count).toBe(2);
    expect(screen.getByRole('progressbar', { name: 'Progress for T' })).toHaveAttribute('aria-valuenow', '11');
  });

  it('a progress write for one book renders one tile, not the grid', async () => {
    await services.db.books.bulkAdd([bookRecord('a'), bookRecord('b'), bookRecord('c')]);
    render(
      <ServicesContext.Provider value={services}>
        <MemoryRouter>
          <LibraryPage />
        </MemoryRouter>
      </ServicesContext.Provider>,
    );
    await screen.findByText('Title a');
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3));
    await new Promise((r) => setTimeout(r, 50));
    const before = cardRenders.count;
    await act(async () => {
      await services.db.progress.put({ bookId: 'b', mode: 'read', locator: { kind: 'reflow', section: 0, textOffset: 1 }, percent: 50, updatedAt: 9 });
    });
    await waitFor(() => expect(screen.getByRole('progressbar', { name: 'Progress for Title b' })).toHaveAttribute('aria-valuenow', '50'));
    expect(cardRenders.count - before).toBe(1);
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
    const { rerender } = renderHook(() => useLibraryPage({ text: 'x', limit: 5 }), { wrapper: wrapper(withQuery(query as DataClient['library']['query'])) });
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
      await services.db.progress.put({ bookId: 'x', mode: 'read', locator: { kind: 'reflow', section: 0, textOffset: 0 }, percent: 30, updatedAt: 1 });
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
    const covers = new CoverUrlCache({ load: () => new Promise<Blob>((r) => (finish = r)), createObjectURL: created, revokeObjectURL: revoke, maxIdle: 0 });
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
