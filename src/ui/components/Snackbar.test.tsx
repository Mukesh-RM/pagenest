import '../test/setup';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SNACKBAR_DURATION_MS, SnackbarProvider, useSnackbar, type SnackbarOptions } from './Snackbar';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function Trigger({ options, label = 'show' }: { options: SnackbarOptions; label?: string }) {
  const snackbar = useSnackbar();
  return <button onClick={() => snackbar.show(options)}>{label}</button>;
}

function setup(options: SnackbarOptions) {
  render(
    <SnackbarProvider>
      <Trigger options={options} />
    </SnackbarProvider>,
  );
  fireEvent.click(screen.getByText('show'));
}

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('Snackbar with Undo', () => {
  it('auto-dismisses after exactly 8 seconds and reports "timeout"', () => {
    const onDismiss = vi.fn();
    setup({ message: 'Book deleted', onAction: () => undefined, onDismiss });
    expect(SNACKBAR_DURATION_MS).toBe(8000);
    expect(screen.getByText('Book deleted')).toBeInTheDocument();
    advance(7999);
    expect(screen.getByText('Book deleted')).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
    advance(1);
    expect(screen.queryByText('Book deleted')).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith('timeout');
  });

  it('Undo runs the action, closes at once and the 8 s timer never fires afterwards', () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    setup({ message: 'Book deleted', onAction, onDismiss });
    advance(3000);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Book deleted')).toBeNull();
    expect(onDismiss).toHaveBeenCalledWith('action');
    advance(20000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('the Undo button is a real 44 px action button; there is no button without an action', () => {
    setup({ message: 'Moved to shelf', onAction: () => undefined });
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveClass('pn-snackbar__action');
  });

  it('a message without onAction shows no button', () => {
    setup({ message: 'Saved' });
    expect(within(screen.getByRole('status')).queryByRole('button')).toBeNull();
  });

  it('supports a custom action label and duration', () => {
    const onDismiss = vi.fn();
    setup({ message: 'Hidden', actionLabel: 'Restore', onAction: () => undefined, durationMs: 2000, onDismiss });
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
    advance(2000);
    expect(onDismiss).toHaveBeenCalledWith('timeout');
  });

  it('is announced politely through a persistent live region', () => {
    render(
      <SnackbarProvider>
        <Trigger options={{ message: 'Announce me' }} />
      </SnackbarProvider>,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
    fireEvent.click(screen.getByText('show'));
    expect(region).toHaveTextContent('Announce me');
  });

  it('a new snackbar replaces the current one and tells it "replaced" (commit the earlier delete)', () => {
    const first = vi.fn();
    render(
      <SnackbarProvider>
        <Trigger label="one" options={{ message: 'First', onDismiss: first }} />
        <Trigger label="two" options={{ message: 'Second' }} />
      </SnackbarProvider>,
    );
    fireEvent.click(screen.getByText('one'));
    fireEvent.click(screen.getByText('two'));
    expect(first).toHaveBeenCalledWith('replaced');
    expect(screen.queryByText('First')).toBeNull();
    expect(screen.getByText('Second')).toBeInTheDocument();
    advance(8000);
    expect(screen.queryByText('Second')).toBeNull();
  });

  it('pauses while hovered or focused and resumes afterwards', () => {
    setup({ message: 'Pausable', onAction: () => undefined });
    const bar = screen.getByText('Pausable').parentElement!;
    advance(5000);
    fireEvent.mouseEnter(bar);
    advance(60000);
    expect(screen.getByText('Pausable')).toBeInTheDocument();
    fireEvent.mouseLeave(bar);
    advance(2999);
    expect(screen.getByText('Pausable')).toBeInTheDocument();
    advance(1);
    expect(screen.queryByText('Pausable')).toBeNull();
  });

  it('dismiss(id) closes only the matching snackbar', () => {
    let api!: ReturnType<typeof useSnackbar>;
    function Grab() {
      api = useSnackbar();
      return null;
    }
    render(
      <SnackbarProvider>
        <Grab />
      </SnackbarProvider>,
    );
    let id = 0;
    act(() => {
      id = api.show({ message: 'Mine' });
    });
    act(() => api.dismiss(id + 99));
    expect(screen.getByText('Mine')).toBeInTheDocument();
    act(() => api.dismiss(id));
    expect(screen.queryByText('Mine')).toBeNull();
  });

  it('useSnackbar outside a provider explains what is missing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Trigger options={{ message: 'x' }} />)).toThrow(/SnackbarProvider/);
    spy.mockRestore();
  });
});
