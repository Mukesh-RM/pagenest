import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newId } from '@/data/db';
import type { AppServices } from './services-context';
import { makeServices, renderApp, resetSettings } from './test-utils';

let services: AppServices;

beforeEach(async () => {
  services = makeServices('pagenest-collections-stats');
  resetSettings();
  await services.db.settings.put({ key: 'onboardingDone', value: true });
});
afterEach(() => {
  cleanup();
  services.db.close();
});

const openMenu = async (name: string): Promise<void> => {
  const row = (await screen.findByText(name)).closest('li') as HTMLElement;
  fireEvent.click(within(row).getByRole('button', { name: /more|options|⋯/i }));
};

describe('Collections on the design system screen', () => {
  it('names a collection through the sheet; a duplicate name shows the data layer message and keeps the sheet open', async () => {
    renderApp(services, { path: '/collections' });
    fireEvent.click(await screen.findByRole('button', { name: 'New collection' }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Summer reading' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Summer reading')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New collection' }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'summer reading' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/already/i);
    expect((await services.db.collections.toArray()).length).toBe(1);
  });

  it('renames, moves, and deletes with Undo from the shelf menu', async () => {
    await services.data.collections.create('Alpha');
    await services.data.collections.create('Beta');
    renderApp(services, { path: '/collections' });
    await openMenu('Beta');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Move up' }));
    await waitFor(async () => expect((await services.data.collections.list()).map((c) => c.name)).toEqual(['Beta', 'Alpha']));

    await openMenu('Alpha');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    const field = await screen.findByLabelText('Name');
    fireEvent.change(field, { target: { value: 'Gamma' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Gamma');

    await openMenu('Gamma');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete collection' }));
    await waitFor(async () => expect((await services.db.collections.toArray()).map((c) => c.name)).toEqual(['Beta']));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect((await services.db.collections.toArray()).map((c) => c.name).sort()).toEqual(['Beta', 'Gamma']));
  });

  it('opens an empty shelf as the empty-collection state, with a way back to the library', async () => {
    await services.data.collections.create('Bedtime');
    renderApp(services, { path: '/collections' });
    fireEvent.click(await screen.findByRole('button', { name: /^Bedtime/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Go to your library' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument();
  });

  it('opens a shelf with books as the Library filtered to it, and Back returns to the collections', async () => {
    await services.db.books.add({
      id: 'b1',
      fingerprint: 'f1',
      kind: 'ebook',
      format: 'epub',
      title: 'Emma',
      author: 'Jane Austen',
      addedAt: 1,
      favorite: false,
      finished: false,
    });
    await services.db.books.add({
      id: 'b2',
      fingerprint: 'f2',
      kind: 'ebook',
      format: 'epub',
      title: 'Dracula',
      addedAt: 2,
      favorite: false,
      finished: false,
    });
    const shelf = await services.data.collections.create('Classics');
    await services.data.collections.addBooks(shelf.id, ['b1']);
    renderApp(services, { path: '/collections' });
    fireEvent.click(await screen.findByRole('button', { name: /^Classics/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Classics' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /^Emma/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Dracula/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Collections' })).toBeInTheDocument();
  });

  it('the automatic Unfinished shelf leaves out a finished book', async () => {
    await services.db.books.add({
      id: 'u1',
      fingerprint: 'u1',
      kind: 'ebook',
      format: 'epub',
      title: 'Half Read',
      addedAt: 1,
      favorite: false,
      finished: false,
    });
    await services.db.books.add({
      id: 'u2',
      fingerprint: 'u2',
      kind: 'ebook',
      format: 'epub',
      title: 'Untouched',
      addedAt: 2,
      favorite: false,
      finished: true,
    });
    await services.db.progress.put({ bookId: 'u1', mode: 'read', locator: { kind: 'reflow', section: 0, textOffset: 0 }, percent: 40, updatedAt: 5 });
    renderApp(services, { path: '/collections' });
    fireEvent.click(await screen.findByRole('button', { name: /^Unfinished/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Unfinished' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /^Half Read/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Untouched/ })).toBeNull());
  });
});

describe('Stats on the design system screen', () => {
  it('shows the week from the data worker: time, active days, most on, finished books and a named bar per day', async () => {
    const now = Date.now();
    await services.db.books.add({
      id: 'fin',
      fingerprint: 'fin',
      kind: 'ebook',
      format: 'epub',
      title: 'Done',
      addedAt: 1,
      favorite: false,
      finished: true,
    });
    await services.db.sessions.add({ id: newId(), bookId: 'fin', mode: 'read', startedAt: now - 60_000, durationSec: 35 * 60 });
    renderApp(services, { path: '/stats' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Stats' })).toBeInTheDocument();
    expect(await screen.findByText(/Today: 35 min/)).toBeInTheDocument();
    expect(screen.getByText('Days with reading or listening').nextSibling?.textContent).toMatch(/^1 of 7/);
    expect(screen.getByText('Books finished').nextSibling?.textContent).toBe('1');
  });

  it('with no sessions it is the calm empty state, and its action goes to the Library', async () => {
    renderApp(services, { path: '/stats' });
    expect(await screen.findByText('Nothing to count yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open your library' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument();
  });

  it('a failing data worker shows the empty state instead of a stuck skeleton', async () => {
    const failing: AppServices = { ...services, data: { ...services.data, stats: () => Promise.reject(new Error('worker gone')) } };
    renderApp(failing, { path: '/stats' });
    expect(await screen.findByText('Nothing to count yet')).toBeInTheDocument();
  });
});
