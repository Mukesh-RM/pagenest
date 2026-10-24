import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { BACK_DEPTH_KEY } from '../back';
import type { PageNestDB } from '@/data/db';
import { makeServices, renderApp, resetSettings } from '../test-utils';

let db: PageNestDB;

const depth = (): number => ((window.history.state as Record<string, unknown> | null)?.[BACK_DEPTH_KEY] as number | undefined) ?? 0;
const back = async (): Promise<void> => {
  await act(async () => {
    window.history.back();
    await new Promise((r) => setTimeout(r, 30));
  });
};

beforeEach(async () => {
  window.history.replaceState(null, '', '/');
  const services = makeServices('pagenest-sheet-test');
  db = services.db;
  resetSettings();
  await db.settings.put({ key: 'onboardingDone', value: true });
  renderApp(services, { browserHistory: true });
  await screen.findByRole('navigation', { name: 'Main' });
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Settings' }));
  await screen.findByRole('heading', { level: 1, name: 'Settings' });
});

afterEach(() => {
  cleanup();
  db.close();
});

const openHelp = () => fireEvent.click(screen.getByRole('button', { name: /install help/i }));

describe('Install help sheet (settings)', () => {
  it('opens as a dialog with the three iPhone steps and moves focus into it', async () => {
    openHelp();
    const dialog = await screen.findByRole('dialog', { name: 'Install help' });
    expect(dialog).toHaveFocus();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const steps = within(dialog).getAllByRole('listitem').map((li) => li.textContent);
    expect(steps).toEqual(['Tap the Share button.', 'Tap Add to Home Screen.', 'Tap Add.']);
  });

  it('closes with its Close button and returns focus to the button that opened it', async () => {
    const opener = screen.getByRole('button', { name: /install help/i });
    opener.focus();
    openHelp();
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
    await waitFor(() => expect(depth()).toBe(0));
  });

  it('closes with Done, Escape and a tap on the backdrop', async () => {
    openHelp();
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    openHelp();
    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    openHelp();
    const dialog = await screen.findByRole('dialog');
    const backdrop = dialog.parentElement?.firstElementChild as HTMLElement;
    fireEvent.click(backdrop);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(depth()).toBe(0));
  });

  it('keeps Tab inside the sheet', async () => {
    openHelp();
    const dialog = await screen.findByRole('dialog');
    const close = within(dialog).getByRole('button', { name: 'Close' });
    const done = within(dialog).getByRole('button', { name: 'Done' });
    done.focus();
    fireEvent.keyDown(done, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(done).toHaveFocus();
  });

  it('the back gesture closes the sheet first and stays on Settings, then goes to the Library', async () => {
    openHelp();
    await screen.findByRole('dialog');
    await waitFor(() => expect(depth()).toBe(1));

    await back();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/settings');

    await back();
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('closing in code leaves back going straight to the previous screen', async () => {
    openHelp();
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(depth()).toBe(0));
    await back();
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument();
  });
});
