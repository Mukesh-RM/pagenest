import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BookRecord } from '@/data/schema';
import { getSetting, setSetting } from '@/data/settings';
import type { AppServices } from './services-context';
import { makeServices, renderApp, resetSettings } from './test-utils';

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
  it('opens the live reader in the design chrome, with no placeholder, and says so plainly when a record has no file', async () => {
    await services.db.books.add(book('b1', { title: 'The Long Road' }));
    renderApp(services, { path: '/read/b1' });
    expect(await screen.findByRole('heading', { level: 1, name: 'The Long Road' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('This book has no file');
    expect(screen.queryByText(/arrives in a later release/)).not.toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('uses the design system reader chrome: serif title in the reader theme, with the chapter and a progress footer', async () => {
    await services.db.books.add(book('b1', { title: 'The Long Road' }));
    const { container } = renderApp(services, { path: '/read/b1' });
    const title = await screen.findByRole('heading', {
      level: 1,
      name: 'The Long Road',
    });
    expect(title).toHaveClass('pn-reader__title');
    expect(container.querySelector('.pn-reader')).toHaveAttribute('data-theme');
    expect(screen.getByRole('progressbar', { name: 'Progress through the book' })).toBeInTheDocument();
  });

  it('shows the saved percent and chapter from resume data', async () => {
    await services.db.books.add(book('b1'));
    await services.db.chapters.bulkAdd([
      { bookId: 'b1', index: 0, title: 'Start', locator: { kind: 'reflow', section: 0, textOffset: 0 } },
      { bookId: 'b1', index: 6, title: 'The Storm', locator: { kind: 'reflow', section: 6, textOffset: 0 } },
    ]);
    await services.progress.save('b1', 'read', { kind: 'reflow', section: 6, textOffset: 3 }, 61);
    renderApp(services, { path: '/read/b1' });
    expect(await screen.findByText('Chapter 7: The Storm')).toBeInTheDocument();
    expect(screen.getByText('61% through the book')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progress through the book' })).toHaveAttribute('aria-valuenow', '61');
  });

  it('shows a not-found state for an unknown id, with a way home', async () => {
    renderApp(services, { path: '/read/nope' });
    expect(await screen.findByText("We can't find that book")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Library' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument();
  });

  it('sends an audiobook opened on the read route to the listen route', async () => {
    await services.db.books.add(book('a1', { kind: 'audio', format: 'm4b', title: 'Spoken' }));
    renderApp(services, { path: '/read/a1' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Spoken' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('The player arrives in a later release');
  });

  it('has only working controls: Back goes to the Library, Aa opens the reading settings', async () => {
    await services.db.books.add(book('b1'));
    renderApp(services, { path: '/read/b1' });
    await screen.findByRole('heading', { level: 1, name: 'Title b1' });
    expect(screen.getByRole('button', { name: 'Back to library' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reading settings' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to library' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument();
  });

  it('saves reading settings from the Aa sheet and restores them the next time a book opens', async () => {
    await services.db.books.add(book('b1'));
    const first = renderApp(services, { path: '/read/b1' });
    await screen.findByRole('heading', { level: 1, name: 'Title b1' });
    fireEvent.click(screen.getByRole('button', { name: 'Reading settings' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Reading settings',
    });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Sepia/ }));
    await waitFor(async () => expect(((await getSetting(services.db, 'readerSettings')) as { theme: string } | undefined)?.theme).toBe('sepia'));
    first.unmount();

    const second = renderApp(services, { path: '/read/b1' });
    await screen.findByRole('heading', { level: 1, name: 'Title b1' });
    await waitFor(() => expect(second.container.querySelector('.pn-reader')).toHaveAttribute('data-theme', 'sepia'));
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
    expect(screen.getByRole('region', { name: 'Reading Printed' })).toBeInTheDocument();
    expect(screen.queryByText(/arrives in a later release/)).not.toBeInTheDocument();
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
