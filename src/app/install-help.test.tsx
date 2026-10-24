import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import type { PageNestDB } from '@/data/db';
import { resetSheetHistoryForTests } from '@/ui/utils/sheetHistory';
import { makeServices, renderApp, resetSettings } from './test-utils';

let db: PageNestDB;

const back = async (): Promise<void> => {
  await act(async () => {
    window.history.back();
    await new Promise((r) => setTimeout(r, 30));
  });
};

beforeEach(async () => {
  resetSheetHistoryForTests(); // the sheet history is module state; start every test clean
  window.history.replaceState(null, '', '/');
  const services = makeServices('pagenest-install-test');
  db = services.db;
  resetSettings();
  await db.settings.put({ key: 'onboardingDone', value: true });
  renderApp(services, { browserHistory: true });
  const tabs = await screen.findByTestId('pn-tabbar');
  fireEvent.click(within(tabs).getByRole('link', { name: 'Settings' }));
  await screen.findByRole('heading', { level: 1, name: 'Settings' });
});

afterEach(async () => {
  cleanup();
  await new Promise((r) => setTimeout(r, 30)); // let any history traversal from closing a sheet finish
  db.close();
});

const openHelp = () => fireEvent.click(screen.getByRole('button', { name: /install help/i }));

describe('Install help (design system BottomSheet) in Settings', () => {
  it('opens a dialog with the three iPhone steps', async () => {
    openHelp();
    const dialog = await screen.findByRole('dialog', { name: /add pagenest to your iphone/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const steps = within(dialog).getAllByRole('listitem').map((li) => li.textContent);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toMatch(/Share/);
    expect(steps[1]).toMatch(/Add to Home Screen/);
    expect(steps[2]).toMatch(/Add/);
  });

  it('closes with Close, returning focus to the Install help button', async () => {
    const opener = screen.getByRole('button', { name: /install help/i });
    opener.focus();
    openHelp();
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it('closes with Escape', async () => {
    openHelp();
    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('the back gesture closes the sheet first and stays on Settings, then goes to the Library', async () => {
    openHelp();
    await screen.findByRole('dialog');

    await back();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/settings');

    await back();
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('closing in code leaves back going straight to the previous screen', async () => {
    openHelp();
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await back();
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument();
  });
});
