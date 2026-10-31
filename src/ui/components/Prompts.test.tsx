import '../test/setup';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSheetHistoryForTests } from '../utils/sheetHistory';
import { InstallBanner } from './InstallBanner';
import { IosInstallSheet } from './IosInstallSheet';
import { UpdateAvailableSnackbar } from './UpdateAvailableSnackbar';

beforeEach(() => {
  resetSheetHistoryForTests();
  window.history.replaceState(null, '', '/');
});
afterEach(() => resetSheetHistoryForTests());

describe('UpdateAvailableSnackbar', () => {
  it('shows the message with Refresh and Dismiss actions in a polite live region', () => {
    render(<UpdateAvailableSnackbar open onRefresh={() => undefined} onDismiss={() => undefined} />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(within(region).getByText('New version ready.')).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Refresh' })).toHaveClass('pn-snackbar__action');
    expect(within(region).getByRole('button', { name: 'Dismiss' })).toHaveClass('pn-snackbar__action');
  });

  it('calls onRefresh and onDismiss; never closes by itself (no timer)', async () => {
    vi.useFakeTimers();
    const onRefresh = vi.fn();
    const onDismiss = vi.fn();
    render(<UpdateAvailableSnackbar open onRefresh={onRefresh} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('New version ready.')).toBeInTheDocument();
    vi.useRealTimers();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders nothing visible but keeps the live region when closed, and labels are customizable', () => {
    const { rerender } = render(<UpdateAvailableSnackbar open={false} onRefresh={() => undefined} onDismiss={() => undefined} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    rerender(
      <UpdateAvailableSnackbar
        open
        message="Nueva versión"
        refreshLabel="Actualizar"
        dismissLabel="Cerrar"
        onRefresh={() => undefined}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.getByText('Nueva versión')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });
});

describe('InstallBanner', () => {
  it('is a labelled region with Install and Not now actions', () => {
    render(<InstallBanner onInstall={() => undefined} onDismiss={() => undefined} />);
    const region = screen.getByRole('region', { name: 'Install InkQuiet' });
    expect(within(region).getByRole('button', { name: 'Install' })).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Not now' })).toBeInTheDocument();
    expect(region.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('wires the two actions to the callbacks', async () => {
    const user = userEvent.setup();
    const onInstall = vi.fn();
    const onDismiss = vi.fn();
    render(<InstallBanner onInstall={onInstall} onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: 'Install' }));
    expect(onInstall).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when open is false and supports custom text', () => {
    const { rerender } = render(<InstallBanner open={false} onInstall={() => undefined} onDismiss={() => undefined} />);
    expect(screen.queryByRole('region')).toBeNull();
    rerender(<InstallBanner title="Instalar" description="Texto" installLabel="Sí" dismissLabel="Luego" onInstall={() => undefined} onDismiss={() => undefined} />);
    expect(screen.getByRole('region', { name: 'Instalar' })).toBeInTheDocument();
    expect(screen.getByText('Texto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sí' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Luego' })).toBeInTheDocument();
  });
});

describe('IosInstallSheet', () => {
  it('is a modal dialog with the three steps in order: Share, Add to Home Screen, Add', () => {
    render(<IosInstallSheet open onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: 'Add InkQuiet to your iPhone' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const steps = within(dialog).getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent('Step 1: Tap Share');
    expect(steps[1]).toHaveTextContent('Step 2: Scroll and tap Add to Home Screen');
    expect(steps[2]).toHaveTextContent('Step 3: Tap Add');
    expect(within(dialog).getByRole('list').tagName).toBe('OL');
    for (const step of steps) expect(step.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('Got it closes with reason "done"; Esc and the close button report their own reasons', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<IosInstallSheet open onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onClose).toHaveBeenLastCalledWith('done');
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenLastCalledWith('escape');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenLastCalledWith('close-button');
  });

  it('closes on the system back gesture like every other sheet', async () => {
    const onClose = vi.fn();
    render(<IosInstallSheet open onClose={onClose} />);
    act(() => window.history.back());
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('back'));
  });

  it('renders nothing while closed', () => {
    render(<IosInstallSheet open={false} onClose={() => undefined} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
