import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookRecord } from '@/data/schema';
import { setSetting } from '@/data/settings';
import type { AppServices } from './services-context';
import { makeServices, renderApp, resetSettings } from './test-utils';

// The real reader needs a browser (engines, layout), so these tests stop at the hand-off: the route loads the book, checks its kind and mounts it by id.
vi.mock('@/features/reader/ReaderScreen', async () => ({ ReaderScreen: (await import('./fake-reader')).FakeReader }));

const book = (id: string, rest: Partial<BookRecord> = {}): BookRecord => ({
  id,
  fingerprint: `fp-${id}`,
  kind: 'ebook',
  format: 'epub',
  title: `Title ${id}`,
  author: 'Ann Lee',
  addedAt: 1,
  favorite: false,
  finished: false,
  ...rest,
});

let services: AppServices;

beforeEach(async () => {
  resetSettings();
  localStorage.clear();
  services = makeServices('book-routes');
  await setSetting(services.db, 'onboardingDone', true);
});
afterEach(() => services.db.close());

describe('/read/:id', () => {
  it("opens the Reader bot's reader with the book id", async () => {
    await services.db.books.add(book('b1', { title: 'The Long Road' }));
    renderApp(services, { path: '/read/b1' });
    expect(await screen.findByTestId('reader-screen')).toHaveAttribute('data-book', 'b1');
  });

  it('shows a not-found state for an unknown id, with a way home', async () => {
    renderApp(services, { path: '/read/nope' });
    expect(await screen.findByText("We can't find that book")).toBeInTheDocument();
    expect(screen.queryByTestId('reader-screen')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Library' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument();
  });

  it('sends an audiobook opened on the read route to the listen route', async () => {
    await services.db.books.add(book('a1', { kind: 'audio', format: 'm4b', title: 'Spoken' }));
    renderApp(services, { path: '/read/a1' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Spoken' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('The player arrives in a later release');
    expect(screen.queryByTestId('reader-screen')).not.toBeInTheDocument();
  });

  it('opens another book in a fresh reader when the id changes', async () => {
    await services.db.books.bulkAdd([book('b1'), book('b2')]);
    const first = renderApp(services, { path: '/read/b1' });
    expect(await screen.findByTestId('reader-screen')).toHaveAttribute('data-book', 'b1');
    first.unmount();
    renderApp(services, { path: '/read/b2' });
    expect(await screen.findByTestId('reader-screen')).toHaveAttribute('data-book', 'b2');
  });
});

describe('/listen/:id', () => {
  it('shows an audiobook with its progress', async () => {
    await services.db.books.add(book('a1', { kind: 'audio', format: 'm4b', title: 'Spoken' }));
    await services.progress.save('a1', 'listen', { kind: 'audio', trackIndex: 0, positionSec: 30 }, 25);
    renderApp(services, { path: '/listen/a1' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Spoken' })).toBeInTheDocument();
    expect(screen.getByText('25% done')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('The player arrives in a later release');
  });

  it('sends an e-book opened on the listen route to the read route', async () => {
    await services.db.books.add(book('b1', { title: 'Printed' }));
    renderApp(services, { path: '/listen/b1' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Printed' })).toBeInTheDocument();
    expect(await screen.findByTestId('reader-screen')).toHaveAttribute('data-book', 'b1');
  });

  it('shows not found for an unknown id', async () => {
    renderApp(services, { path: '/listen/zzz' });
    expect(await screen.findByText("We can't find that book")).toBeInTheDocument();
  });
});

describe('from the Library', () => {
  it('tapping the Welcome back card opens the book route for its kind', async () => {
    await services.db.books.add(book('a1', { kind: 'audio', format: 'm4b', title: 'Spoken' }));
    await services.progress.save('a1', 'listen', { kind: 'audio', trackIndex: 0, positionSec: 9 }, 10);
    renderApp(services);
    const button = await screen.findByRole('button', {
      name: 'Keep listening',
    });
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    fireEvent.click(button);
    expect(await screen.findByRole('heading', { level: 1, name: 'Spoken' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('10% done')).toBeInTheDocument());
  });
});
