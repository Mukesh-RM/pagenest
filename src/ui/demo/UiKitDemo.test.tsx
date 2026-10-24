import '../test/setup';
import { render, screen, within } from '@testing-library/react';
import userEvent from '../test/user';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetSheetHistoryForTests } from '../utils/sheetHistory';
import UiKitDemo, { UiKitDemo as NamedDemo } from './UiKitDemo';

beforeEach(() => resetSheetHistoryForTests());
afterEach(() => resetSheetHistoryForTests());

describe('UiKitDemo', () => {
  it('is exported both as default and named, so the router can lazy-import it', () => {
    expect(UiKitDemo).toBe(NamedDemo);
  });

  it('shows every component, and one panel per theme', () => {
    render(<UiKitDemo defaultMode="light" />);
    expect(screen.getByRole('heading', { level: 1, name: 'PageNest UI kit' })).toBeInTheDocument();
    for (const section of [
      'All themes side by side',
      'Buttons',
      'Chips',
      'Bottom sheet',
      'Mini-player (visual only)',
      'Snackbar with Undo (8 s)',
      'Skeleton',
      'Empty state',
      'Install and update prompts (visual only)',
    ]) {
      expect(screen.getByRole('heading', { name: new RegExp(section.replace(/[()]/g, '\\$&')) })).toBeInTheDocument();
    }
    for (const theme of ['light', 'sepia', 'dark', 'black']) {
      expect(document.querySelector(`.pn-demo__theme-panel[data-theme="${theme}"]`)).not.toBeNull();
    }
    expect(screen.getByRole('navigation', { name: 'Demo tab bar' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Demo rail' })).toBeInTheDocument();
  });

  it('the switcher changes the scoped theme without touching the document root', async () => {
    const user = userEvent.setup();
    render(<UiKitDemo defaultMode="light" />);
    const scope = document.querySelector<HTMLElement>('.pn-demo-scope')!;
    expect(scope).toHaveAttribute('data-theme', 'light');
    const switcher = screen.getByRole('group', { name: 'App theme' });
    await user.click(within(switcher).getByRole('button', { name: 'Sepia' }));
    expect(scope).toHaveAttribute('data-theme', 'sepia');
    await user.click(within(switcher).getByRole('button', { name: 'Black' }));
    expect(scope).toHaveAttribute('data-theme', 'black');
    expect(within(switcher).getByRole('button', { name: 'Black' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('opens and closes a sheet, and shows the Undo snackbar', async () => {
    const user = userEvent.setup();
    render(<UiKitDemo defaultMode="dark" />);
    await user.click(screen.getByRole('button', { name: 'Open sheet' }));
    const dialog = screen.getByRole('dialog', { name: 'Look and feel' });
    expect(dialog.closest('.pn-portal')).toHaveAttribute('data-theme', 'dark');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Delete a book' }));
    expect(screen.getByText('Moby Dick deleted')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Undo' }).length).toBeGreaterThan(0);
  });
});
