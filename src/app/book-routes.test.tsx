import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BookRecord } from '@/data/schema';
import { setSetting } from '@/data/settings';
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
  it('shows the book, a not-started state and the honest note', async () => {
    await services.db.books.add(book('b1', { title: 'The Long Road' }));
    renderApp(services, { path: '/read/b1' });
    expect(await screen.findByRole('heading', { level: 1, name: 'The Long Road' })).toBeInTheDocument();
    expect(screen.getByText(/Ann Lee/)).toBeInTheDocument();
    expect(screen.getByText('Not started yet')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('The reader arrives in a later release');
  });

  it('shows the saved percent and chapter from resume data', async () => {
    await services.db.books.add(book('b1'));
    await services.db.chapters.bulkAdd([
      { bookId: 'b1', index: 0, title: 'Start', locator: { kind: 'reflow', section: 0, textOffset: 0 } },
      { bookId: 'b1', index: 6, title: 'The Storm', locator: { kind: 'reflow', section: 6, textOffset: 0 } },
    ]);
    await services.progress.save('b1', 'read', { kind: 'reflow', section: 6, textOffset: 3 }, 61);
    renderApp(services, { path: '/read/b1' });
    expect(await screen.findByText('You stopped at chapter 7')).toBeInTheDocument();
    expect(screen.getByText('The Storm')).toBeInTheDocument();
    expect(screen.getByText('61% done')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progress for Title b1' })).toHaveAttribute('aria-valuenow', '61');
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

  it('has a working link back to the Library and no buttons that do nothing', async () => {
    await services.db.books.add(book('b1'));
    renderApp(services, { path: '/read/b1' });
    await screen.findByRole('heading', { level: 1, name: 'Title b1' });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    fireEvent.click(screen.getByRole('link', { name: 'Back to Library' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument();
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
    expect(screen.getByRole('note')).toHaveTextContent('The reader arrives in a later release');
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
    const link = await screen.findByRole('link', { name: /Welcome back/ });
    expect(link).toHaveAttribute('href', '/listen/a1');
    fireEvent.click(link);
    expect(await screen.findByRole('heading', { level: 1, name: 'Spoken' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('10% done')).toBeInTheDocument());
  });
});
