import './test/setup';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_SHORTCUTS,
  ShortcutsProvider,
  formatKey,
  resolveBindings,
  useShortcuts,
  type ShortcutHandlers,
  type UseShortcutsOptions,
} from './shortcuts';
import { resetSheetHistoryForTests } from './utils/sheetHistory';

beforeEach(() => {
  resetSheetHistoryForTests();
  window.history.replaceState(null, '', '/');
});
afterEach(() => resetSheetHistoryForTests());

function Probe({ handlers, options }: { handlers: ShortcutHandlers; options?: UseShortcutsOptions }) {
  useShortcuts(handlers, options);
  return (
    <div>
      <button>A button</button>
      <input aria-label="Search field" />
      <textarea aria-label="Notes" />
      <a href="#x">A link</a>
    </div>
  );
}

const press = (key: string, init: KeyboardEventInit = {}, target: Element | Document = document.body) =>
  fireEvent.keyDown(target, { key, ...init });

describe('useShortcuts', () => {
  it('maps the default keys: space, arrows, j/k, /, t, Esc', () => {
    const h = {
      playPause: vi.fn(),
      seekBack: vi.fn(),
      seekForward: vi.fn(),
      next: vi.fn(),
      previous: vi.fn(),
      search: vi.fn(),
      theme: vi.fn(),
      close: vi.fn(),
    };
    render(<Probe handlers={h} />);
    press(' ');
    press('ArrowLeft');
    press('ArrowRight');
    press('j');
    press('k');
    press('/');
    press('t');
    press('Escape');
    for (const [name, fn] of Object.entries(h)) expect(fn, name).toHaveBeenCalledTimes(1);
  });

  it('letters match in either case and an unhandled action does nothing', () => {
    const next = vi.fn();
    render(<Probe handlers={{ next }} />);
    press('J');
    press('t');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('prevents the default action (space must not scroll the page) when it handles a key', () => {
    render(<Probe handlers={{ playPause: vi.fn() }} />);
    expect(press(' ')).toBe(false); // fireEvent returns false when preventDefault was called
  });

  it('ignores keys while typing in an input, textarea or select', () => {
    const h = { playPause: vi.fn(), search: vi.fn(), next: vi.fn() };
    render(<Probe handlers={h} />);
    press(' ', {}, screen.getByLabelText('Search field'));
    press('/', {}, screen.getByLabelText('Search field'));
    press('j', {}, screen.getByLabelText('Notes'));
    expect(h.playPause).not.toHaveBeenCalled();
    expect(h.search).not.toHaveBeenCalled();
    expect(h.next).not.toHaveBeenCalled();
  });

  it('Esc still reaches the close handler from a field, so it can leave the search box', () => {
    const close = vi.fn();
    render(<Probe handlers={{ close }} />);
    press('Escape', {}, screen.getByLabelText('Search field'));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('leaves space and arrows to a focused button or link', () => {
    const h = { playPause: vi.fn(), seekForward: vi.fn() };
    render(<Probe handlers={h} />);
    press(' ', {}, screen.getByRole('button', { name: 'A button' }));
    press('ArrowRight', {}, screen.getByRole('link', { name: 'A link' }));
    expect(h.playPause).not.toHaveBeenCalled();
    expect(h.seekForward).not.toHaveBeenCalled();
  });

  it('ignores combinations with Ctrl, Meta or Alt (browser shortcuts keep working)', () => {
    const search = vi.fn();
    render(<Probe handlers={{ search }} />);
    press('/', { ctrlKey: true });
    press('/', { metaKey: true });
    press('/', { altKey: true });
    expect(search).not.toHaveBeenCalled();
  });

  it('can be remapped by props, and the default key stops working', () => {
    const next = vi.fn();
    const search = vi.fn();
    render(<Probe handlers={{ next, search }} options={{ bindings: { next: ['n', 'PageDown'], search: [] } }} />);
    press('j');
    expect(next).not.toHaveBeenCalled();
    press('n');
    press('PageDown');
    expect(next).toHaveBeenCalledTimes(2);
    press('/');
    expect(search).not.toHaveBeenCalled(); // an empty list disables the action
  });

  it('is off when enabled is false and removes its listener on unmount', () => {
    const playPause = vi.fn();
    const { rerender, unmount } = render(<Probe handlers={{ playPause }} options={{ enabled: false }} />);
    press(' ');
    expect(playPause).not.toHaveBeenCalled();
    rerender(<Probe handlers={{ playPause }} options={{ enabled: true }} />);
    press(' ');
    expect(playPause).toHaveBeenCalledTimes(1);
    unmount();
    press(' ');
    expect(playPause).toHaveBeenCalledTimes(1);
  });

  it('always calls the latest handler without re-subscribing', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Probe handlers={{ next: first }} />);
    rerender(<Probe handlers={{ next: second }} />);
    press('j');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('key helpers', () => {
  it('labels keys in plain words', () => {
    expect(formatKey(' ')).toBe('Space');
    expect(formatKey('ArrowLeft')).toBe('←');
    expect(formatKey('j')).toBe('J');
    expect(formatKey('Escape')).toBe('Esc');
  });

  it('resolveBindings merges over the defaults', () => {
    expect(resolveBindings({ next: ['n'] }).next).toEqual(['n']);
    expect(resolveBindings({ next: ['n'] }).previous).toEqual(DEFAULT_SHORTCUTS.previous);
  });
});

describe('ShortcutsProvider and the ? help dialog', () => {
  it('? opens a labelled dialog listing the keys; Esc closes it and focus returns', async () => {
    render(
      <ShortcutsProvider handlers={{ playPause: vi.fn() }}>
        <button>Library</button>
      </ShortcutsProvider>,
    );
    const opener = screen.getByRole('button', { name: 'Library' });
    opener.focus();
    press('?', { shiftKey: true }, opener);
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const list = within(dialog);
    expect(list.getByText('Space')).toBeInTheDocument();
    expect(list.getByText('Play or pause')).toBeInTheDocument();
    expect(list.getByText('Esc')).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(opener).toHaveFocus();
  });

  it('shows remapped keys in the dialog', async () => {
    render(
      <ShortcutsProvider handlers={{ next: vi.fn() }} bindings={{ next: ['n'] }}>
        <p>page</p>
      </ShortcutsProvider>,
    );
    press('?', { shiftKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    const row = within(dialog).getByText('Next chapter or next book in the list').parentElement!;
    expect(within(row).getByText('N')).toBeInTheDocument();
  });

  it('the app-wide handlers still run while the provider is mounted', () => {
    const search = vi.fn();
    render(
      <ShortcutsProvider handlers={{ search }}>
        <p>page</p>
      </ShortcutsProvider>,
    );
    press('/');
    expect(search).toHaveBeenCalledTimes(1);
  });
});
