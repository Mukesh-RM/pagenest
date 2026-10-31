import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MiniPlayerSlot } from '@/app/contracts';
import type { BookRecord } from '@/data/schema';
import { setSetting } from '@/data/settings';
import { resetRouteChromeForTests } from './route-chrome';
import type { AppServices } from './services-context';
import { makeServices, renderApp, resetSettings } from './test-utils';

const book = (id: string, rest: Partial<BookRecord> = {}): BookRecord => ({
  id,
  fingerprint: `fp-${id}`,
  kind: 'ebook',
  format: 'epub',
  title: `Title ${id}`,
  addedAt: 1,
  favorite: false,
  finished: false,
  ...rest,
});

let services: AppServices;

async function launch(extra: Partial<AppServices> = {}): Promise<AppServices> {
  services = { ...makeServices('chrome'), ...extra };
  await setSetting(services.db, 'onboardingDone', true);
  return services;
}

const scope = (container: HTMLElement): HTMLElement => {
  const el = container.querySelector<HTMLElement>('.pn-shell');
  if (!el) throw new Error('no app frame');
  return el;
};

beforeEach(() => {
  resetSettings();
  resetRouteChromeForTests();
  localStorage.clear();
});
afterEach(() => services.db.close());

describe('app frame per route', () => {
  it.each(['/', '/collections', '/stats', '/settings'])('tab route %s is full chrome with the tab bar and rail', async (path) => {
    await launch();
    const { container } = renderApp(services, { path });
    await screen.findByRole('heading', { level: 1 });
    expect(scope(container)).toHaveAttribute('data-chrome', 'full');
    expect(screen.getByTestId('pn-tabbar')).toBeInTheDocument();
    expect(screen.queryByTestId('pn-rail')).toBeNull(); // phone width: only the tab bar is in the DOM
  });

  it('/read/:id is immersive as soon as the frame exists, before the book has loaded', async () => {
    await launch();
    await services.db.books.add(book('b1'));
    const { container } = renderApp(services, { path: '/read/b1' });
    await waitFor(() => scope(container));
    expect(scope(container)).toHaveAttribute('data-chrome', 'immersive');
    await screen.findByRole('heading', { level: 1, name: 'Title b1' });
    expect(scope(container)).toHaveAttribute('data-chrome', 'immersive');
  });

  it('/listen/:id is immersive', async () => {
    await launch();
    const { ensureSeedAudiobookBookRecord, SEED_AUDIO_BOOK_ID } = await import('@/features/player/seed/seed-audiobook');
    await ensureSeedAudiobookBookRecord(services.db);
    const { container } = renderApp(services, { path: `/listen/${SEED_AUDIO_BOOK_ID}` });
    await screen.findByRole('region', { name: 'Audio player' }, { timeout: 5000 });
    expect(scope(container)).toHaveAttribute('data-chrome', 'immersive');
  });

  it('an unknown book is also immersive and still offers a way home', async () => {
    await launch();
    const { container } = renderApp(services, { path: '/read/none' });
    await screen.findByText("We can't find that book");
    expect(scope(container)).toHaveAttribute('data-chrome', 'immersive');
    fireEvent.click(screen.getByRole('button', { name: 'Go to Library' }));
    await screen.findByRole('heading', { level: 1, name: 'Library' });
    expect(scope(container)).toHaveAttribute('data-chrome', 'full');
  });

  it('keeps the same frame element across routes (the screen is never remounted by a chrome change)', async () => {
    await launch();
    await services.db.books.add(book('b1'));
    const { container } = renderApp(services, { path: '/read/b1' });
    await screen.findByRole('heading', { level: 1, name: 'Title b1' });
    const frame = container.querySelector('.pn-shell');
    fireEvent.click(screen.getByRole('button', { name: 'Back to library' }));
    await screen.findByRole('heading', { level: 1, name: 'Library' });
    expect(container.querySelector('.pn-shell')).toBe(frame);
    expect(scope(container)).toHaveAttribute('data-chrome', 'full');
  });

  it('tab routes sit in the design system page frame (its own margins) and are not affected by the immersive chrome', async () => {
    await launch();
    const { container } = renderApp(services, { path: '/stats' });
    await screen.findByRole('heading', { level: 1, name: 'Stats' });
    expect(container.querySelector('main .pn-screen')).not.toBeNull();
  });
});

function slot(overrides: Partial<MiniPlayerSlot> = {}): MiniPlayerSlot {
  const Component = () => (
    <div className="min-h-[calc(var(--pn-miniplayer-height)+var(--pn-space-2))]">
      <section aria-label="Mini player">Now playing</section>
    </div>
  );
  return { Component, ...overrides };
}

describe('mini-player slot', () => {
  it('is absent, with no reserved space, when nothing is registered', async () => {
    await launch();
    renderApp(services, { path: '/' });
    await screen.findByRole('heading', { level: 1, name: 'Library' });
    expect(screen.queryByTestId('mini-player-slot')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Mini player' })).toBeNull();
  });

  it('shows above the tab bar on tab routes when registered, with its height reserved', async () => {
    await launch({ miniPlayerSlot: slot() });
    renderApp(services, { path: '/stats' });
    const host = await screen.findByTestId('mini-player-slot');
    expect(host.querySelector('.min-h-\\[calc\\(var\\(--pn-miniplayer-height\\)\\+var\\(--pn-space-2\\)\\)\\]')).not.toBeNull();
    expect(screen.getByText('Now playing')).toBeInTheDocument();
    const bottom = host.parentElement;
    expect(bottom?.querySelector('[data-testid="pn-tabbar"]')).not.toBeNull();
    expect(bottom?.firstElementChild).toBe(host);
  });

  it('is not rendered on immersive routes', async () => {
    await launch({ miniPlayerSlot: slot() });
    await services.db.books.add(book('b1'));
    renderApp(services, { path: '/read/b1' });
    await screen.findByRole('heading', { level: 1, name: 'Title b1' });
    expect(screen.queryByTestId('mini-player-slot')).toBeNull();
    expect(screen.queryByText('Now playing')).toBeNull();
  });

  it('comes back when leaving an immersive route', async () => {
    await launch({ miniPlayerSlot: slot() });
    await services.db.books.add(book('b1'));
    renderApp(services, { path: '/read/b1' });
    await screen.findByRole('heading', { level: 1, name: 'Title b1' });
    fireEvent.click(screen.getByRole('button', { name: 'Back to library' }));
    expect(await screen.findByTestId('mini-player-slot')).toBeInTheDocument();
  });

  it('reserves nothing while the slot says it is inactive, and shows when it becomes active', async () => {
    let active = false;
    const listeners = new Set<() => void>();
    const { useSyncExternalStore } = await import('react');
    const useActive = () =>
      useSyncExternalStore(
        (cb) => {
          listeners.add(cb);
          return () => listeners.delete(cb);
        },
        () => active,
      );
    await launch({ miniPlayerSlot: slot({ useActive }) });
    renderApp(services, { path: '/' });
    await screen.findByRole('heading', { level: 1, name: 'Library' });
    expect(screen.queryByTestId('mini-player-slot')).toBeNull();
    active = true;
    listeners.forEach((l) => l());
    await waitFor(() => expect(screen.getByTestId('mini-player-slot')).toBeInTheDocument());
  });
});
