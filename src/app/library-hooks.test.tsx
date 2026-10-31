import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataClient } from '@/data/data-client';
import type { LibraryPage as LibraryPageData } from '@/data/library-query';
import { bookRecord } from '@/data/test-fixtures';
import { useCoverUrl, useCoverUrls, useLibraryPage } from './library-hooks';
import { ServicesContext, type AppServices } from './services-context';
import { makeServices } from './test-utils';

let services: AppServices;
beforeEach(() => {
  services = makeServices('library-hooks');
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
