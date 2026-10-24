import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { newId, type PageNestDB } from '@/data/db';
import type { AppServices } from './services-context';
import { useSettings } from './settings-store';
import { minutesPerDay } from '@/data/stats';
import { makeServices, renderApp, resetSettings } from './test-utils';

let db: PageNestDB;
let services: AppServices;

function renderAt(path: string) {
  return renderApp(services, { path });
}

beforeEach(async () => {
  services = makeServices('pagenest-app-test');
  db = services.db;
  resetSettings();
  // Returning user: onboarding is covered in onboarding.test.tsx.
  await db.settings.put({ key: 'onboardingDone', value: true });
});

afterEach(() => {
  cleanup();
  db.close();
});

describe('app shell', () => {
  it('shows the four tabs in order', async () => {
    renderAt('/');
    const bar = await screen.findByTestId('pn-tabbar');
    expect(bar).toHaveAccessibleName('Main navigation');
    const labels = Array.from(bar.querySelectorAll('a')).map((a) => a.textContent);
    expect(labels).toEqual(['Library', 'Collections', 'Stats', 'Settings']);
    expect(screen.queryByTestId('pn-rail')).toBeNull(); // phone width: only the tab bar is in the DOM
    expect(within(bar).getByRole('link', { name: 'Library' })).toHaveAttribute('aria-current', 'page');
    await screen.findByText('Your library is empty');
  });

  it.each([
    ['/', 'Library', 'Your library is empty'],
    ['/collections', 'Collections', 'No shelves yet'],
    ['/stats', 'Stats', 'Nothing to count yet'],
  ])('%s shows its heading and a plain empty state', async (path, heading, empty) => {
    renderAt(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(await screen.findByText(empty)).toBeInTheDocument();
  });

  it('settings shows appearance, storage and privacy', async () => {
    renderAt('/settings');
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
    expect(await screen.findByText(/does not say how much space|PageNest uses/)).toBeInTheDocument();
    expect(screen.getByText(/collects nothing/)).toBeInTheDocument();
  });

  it('sends unknown addresses to the library', async () => {
    renderAt('/nowhere/at/all');
    expect(await screen.findByText('Your library is empty')).toBeInTheDocument();
  });

  it('lists books from the database with progress', async () => {
    const id = newId();
    await db.books.add({
      id,
      fingerprint: 'x',
      kind: 'ebook',
      format: 'epub',
      title: 'Persuasion',
      author: 'Jane Austen',
      addedAt: 1,
      favorite: false,
      finished: false,
    });
    await db.progress.put({
      bookId: id,
      mode: 'read',
      locator: { kind: 'reflow', section: 0, textOffset: 0 },
      percent: 40,
      updatedAt: 1,
    });
    renderAt('/');
    expect((await screen.findAllByText('Persuasion')).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getAllByText('Jane Austen').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByRole('progressbar', { name: '40% read', hidden: true })).toHaveAttribute('aria-valuenow', '40'));
  });
});

describe('collections', () => {
  it('creates a shelf that persists', async () => {
    renderAt('/collections');
    const input = await screen.findByLabelText('Shelf name');
    fireEvent.change(input, { target: { value: '  Summer reading ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add shelf' }));
    expect(await screen.findByText('Summer reading')).toBeInTheDocument();
    expect(await screen.findByText('0 books')).toBeInTheDocument();
    expect((await db.collections.toArray()).map((c) => c.name)).toEqual(['Summer reading']);
  });
});

describe('theme', () => {
  it('applies the saved theme and persists a change from settings', async () => {
    await db.settings.put({ key: 'appTheme', value: 'sepia' });
    renderAt('/settings');
    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('sepia'));

    fireEvent.click(screen.getByRole('radio', { name: 'Black' }));
    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('black'));
    await waitFor(async () => expect((await db.settings.get('appTheme'))?.value).toBe('black'));
    expect(screen.getByRole('radio', { name: 'Black' })).toBeChecked();
  });

  it('ignores an invalid saved value', async () => {
    await db.settings.put({ key: 'appTheme', value: 'neon' });
    renderAt('/');
    await waitFor(() => expect(useSettings.getState().loaded).toBe(true));
    expect(useSettings.getState().themePreference).toBe('system');
  });
});

describe('minutesPerDay', () => {
  it('buckets sessions into the last 7 days, oldest first', () => {
    const now = new Date(2026, 9, 24, 15, 0, 0).getTime();
    const day = 24 * 60 * 60 * 1000;
    const days = minutesPerDay(
      [
        { startedAt: now, durationSec: 600 },
        { startedAt: now - 2 * day, durationSec: 1800 },
        { startedAt: now - 6 * day, durationSec: 60 },
        { startedAt: now - 7 * day, durationSec: 9999 },
      ],
      now,
    );
    expect(days).toEqual([1, 0, 0, 0, 30, 0, 10]);
  });
});
