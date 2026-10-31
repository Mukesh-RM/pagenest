import '../test/setup';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePwaStore } from '@/sw/pwa-store';
import type { BeforeInstallPromptEventLike } from '@/sw/install';
import { memoryHintStore } from '../components/GestureHint';
import { resetSheetHistoryForTests } from '../utils/sheetHistory';
import { InstallHelp } from './InstallHelp';
import { formatBytes } from './format';
import { INSTALL_BANNER_ID, IOS_INSTALL_ID, PwaPrompts } from './PwaPrompts';

const initial = usePwaStore.getState();

beforeEach(() => {
  usePwaStore.setState(initial, true);
  resetSheetHistoryForTests();
  window.history.replaceState(null, '', '/');
});
afterEach(() => resetSheetHistoryForTests());

function installEvent(outcome: 'accepted' | 'dismissed' = 'accepted'): BeforeInstallPromptEventLike {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEventLike;
  event.prompt = vi.fn(async () => undefined);
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

describe('InstallHelp (Settings row)', () => {
  it('has a button named "Install help" that opens a modal dialog with a Close button', async () => {
    render(<InstallHelp />);
    const opener = screen.getByRole('button', { name: /install help/i });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Install help' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('closes with Close, Done, Escape and the back gesture, and focus returns to the button', async () => {
    render(<InstallHelp />);
    const opener = screen.getByRole('button', { name: /install help/i });
    const open = async () => {
      opener.focus();
      fireEvent.click(opener);
      return screen.findByRole('dialog');
    };

    let dialog = await open();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(opener).toHaveFocus();

    dialog = await open();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await open();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await open();
    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 30));
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('traps Tab inside the dialog', async () => {
    render(<InstallHelp />);
    fireEvent.click(screen.getByRole('button', { name: /install help/i }));
    const dialog = await screen.findByRole('dialog');
    const buttons = within(dialog).getAllByRole('button');
    const last = buttons[buttons.length - 1]!;
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(last);
  });

  it('shows the three iPhone steps first on iPhone Safari', async () => {
    usePwaStore.setState({ iosInstallHint: true });
    render(<InstallHelp />);
    fireEvent.click(screen.getByRole('button', { name: /install help/i }));
    const dialog = await screen.findByRole('dialog');
    const steps = within(dialog).getAllByRole('listitem').map((li) => li.textContent);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toMatch(/Share/);
    expect(steps[1]).toMatch(/Add to Home Screen/);
    expect(steps[2]).toMatch(/Add/);
    const headings = within(dialog).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings[0]).toBe('On iPhone or iPad');
  });

  it('offers the browser install button when the browser can install, and runs the prompt', async () => {
    const event = installEvent('accepted');
    usePwaStore.setState({ installEvent: event });
    render(<InstallHelp />);
    fireEvent.click(screen.getByRole('button', { name: /install help/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Install InkQuiet' }));
    await waitFor(() => expect(event.prompt).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(usePwaStore.getState().installed).toBe(true));
  });

  it('says so when InkQuiet is already installed, and hides the how-to', async () => {
    usePwaStore.setState({ installed: true, iosInstallHint: false });
    render(<InstallHelp />);
    fireEvent.click(screen.getByRole('button', { name: /install help/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('InkQuiet is installed on this device');
    expect(within(dialog).queryByRole('list')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Install InkQuiet' })).toBeNull();
  });

  it('keeps your books safe: asks the browser, shows usage and the offline note', async () => {
    usePwaStore.setState({ offlineReady: true, persist: { supported: true, persisted: false, usageBytes: 12 * 1024 ** 2, quotaBytes: 4 * 1024 ** 3 } });
    const askPersistence = vi.fn(async () => ({ supported: true as const, persisted: true }));
    usePwaStore.setState({ askPersistence });
    render(<InstallHelp />);
    fireEvent.click(screen.getByRole('button', { name: /install help/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Ready to use offline.');
    expect(dialog).toHaveTextContent('12 MB of about 4 GB');
    fireEvent.click(within(dialog).getByRole('button', { name: /ask my browser to keep them/i }));
    expect(askPersistence).toHaveBeenCalledTimes(1);
  });

  it('formats storage sizes in short plain words', () => {
    expect(formatBytes(12 * 1024 ** 2)).toBe('12 MB');
    expect(formatBytes(4 * 1024 ** 3)).toBe('4 GB');
    expect(formatBytes(1.5 * 1024 ** 2)).toBe('1.5 MB');
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 MB');
  });
});

describe('PwaPrompts: update notice', () => {
  it('renders nothing until a version is waiting, then Refresh, which applies the update', async () => {
    const apply = vi.fn(async () => undefined);
    usePwaStore.getState().setApplyUpdate(apply);
    render(<PwaPrompts isPlaying={false} />);
    expect(screen.queryByText('New version ready.')).toBeNull();
    act(() => usePwaStore.getState().setNeedRefresh());
    expect(screen.getByText('New version ready.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
  });

  it('while audio plays there is no Refresh button and the notice says it applies next launch', () => {
    usePwaStore.getState().setNeedRefresh();
    const { rerender } = render(<PwaPrompts isPlaying />);
    expect(screen.getByText(/It will apply the next time you open InkQuiet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull();
    rerender(<PwaPrompts isPlaying={false} />);
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('Dismiss hides it until the next version', () => {
    usePwaStore.getState().setNeedRefresh();
    render(<PwaPrompts isPlaying={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('New version ready.')).toBeNull();
    act(() => usePwaStore.getState().setNeedRefresh());
    expect(screen.getByText('New version ready.')).toBeInTheDocument();
  });

  it('the notice is a polite status region', () => {
    usePwaStore.getState().setNeedRefresh();
    render(<PwaPrompts isPlaying={false} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});

describe('PwaPrompts: install banner and iPhone sheet', () => {
  it('the banner waits for the app to say an offer is welcome, then installs once', async () => {
    const event = installEvent();
    usePwaStore.setState({ installEvent: event });
    const { rerender } = render(<PwaPrompts isPlaying={false} />);
    expect(screen.queryByRole('region', { name: 'Install InkQuiet' })).toBeNull();
    rerender(<PwaPrompts isPlaying={false} installOfferReady />);
    const banner = screen.getByRole('region', { name: 'Install InkQuiet' });
    fireEvent.click(within(banner).getByRole('button', { name: 'Install' }));
    await waitFor(() => expect(event.prompt).toHaveBeenCalledTimes(1));
  });

  it('Not now hides the banner and the store remembers it', () => {
    usePwaStore.setState({ installEvent: installEvent() });
    const store = memoryHintStore();
    const { unmount } = render(<PwaPrompts isPlaying={false} installOfferReady store={store} />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('region', { name: 'Install InkQuiet' })).toBeNull();
    expect(store.hasSeen(INSTALL_BANNER_ID)).toBe(true);
    unmount();
    render(<PwaPrompts isPlaying={false} installOfferReady store={store} />);
    expect(screen.queryByRole('region', { name: 'Install InkQuiet' })).toBeNull();
  });

  it('shows the iPhone sheet once with three steps, and never when installed', async () => {
    usePwaStore.setState({ iosInstallHint: true });
    const store = memoryHintStore();
    const { rerender } = render(<PwaPrompts isPlaying={false} installOfferReady store={store} />);
    const dialog = await screen.findByRole('dialog', { name: /add inkquiet to your iphone/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(store.hasSeen(IOS_INSTALL_ID)).toBe(true);
    rerender(<PwaPrompts isPlaying={false} installOfferReady store={store} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows no install prompt at all in an installed app', () => {
    usePwaStore.setState({ installed: true, iosInstallHint: true, installEvent: installEvent() });
    render(<PwaPrompts isPlaying={false} installOfferReady />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Install InkQuiet' })).toBeNull();
  });
});
