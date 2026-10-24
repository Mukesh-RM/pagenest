import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import type { PageNestDB } from '@/data/db';
import { getSetting } from '@/data/settings';
import { FONT_SIZE_DEFAULT, FONT_SIZE_MAX, FONT_SIZE_MIN } from '../font-size';
import type { AppServices } from '../services-context';
import { useSettings } from '../settings-store';
import { makeServices, renderApp, resetSettings } from '../test-utils';

let services: AppServices;
let db: PageNestDB;

beforeEach(() => {
  services = makeServices('pagenest-onboarding-test');
  db = services.db;
  resetSettings();
  document.documentElement.removeAttribute('style');
  delete document.documentElement.dataset['theme'];
});

afterEach(() => {
  cleanup();
  db.close();
});

const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name });

async function goToLook(): Promise<void> {
  await heading(/no account/i);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await heading('A home for your books');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await heading('Pick a look');
}

describe('first run', () => {
  it('shows the welcome card instead of the app, with focus on its heading', async () => {
    renderApp(services);
    const h = await heading('Your books, your voice, no account.');
    await waitFor(() => expect(h).toHaveFocus());
    expect(screen.getByText(/no sign-in, no ads and no tracking/i)).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.queryByTestId('pn-tabbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('card 2 points to Add books when an importer is registered, and does not promise a later release', async () => {
    const withImporter: AppServices = { ...services, importer: { accept: '.epub', available: () => true, importFiles: async () => [] } };
    renderApp(withImporter);
    await heading(/no account/i);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await heading('A home for your books');
    expect(screen.getByText(/Add your own books with Add books/i)).toBeInTheDocument();
    expect(screen.queryByText(/arrives in the next release/i)).not.toBeInTheDocument();
  });

  it('shows nothing from onboarding while settings are loading, and never flashes it for returning users', async () => {
    await db.settings.put({ key: 'onboardingDone', value: true });
    renderApp(services);
    expect(screen.queryByText(/Step 1 of 3/)).not.toBeInTheDocument();
    expect(await screen.findByTestId('pn-tabbar')).toBeInTheDocument();
    expect(screen.queryByText(/Step \d of 3/)).not.toBeInTheDocument();
  });

  it('walks through all three cards with Next and Back and moves focus each time', async () => {
    renderApp(services);
    await heading(/no account/i);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const second = await heading('A home for your books');
    expect(second).toHaveFocus();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByText(/arrives in the next release/i)).toBeInTheDocument();
    expect(screen.getByText(/works without internet/i)).toBeInTheDocument();
    // card 2 has no add-book control: only navigation buttons exist
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Skip', 'Back', 'Next']);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await heading('Pick a look')).toHaveFocus();
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await heading('A home for your books')).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await heading(/no account/i)).toHaveFocus();
  });

  it('offers the four themes plus match-my-phone as named radios', async () => {
    renderApp(services);
    await goToLook();
    const group = screen.getByRole('group', { name: 'Theme' });
    const names = within(group)
      .getAllByRole('radio')
      .map((r) => r.closest('label')?.textContent);
    expect(names).toEqual(['Light', 'Sepia', 'Dark', 'Black', 'Custom', 'Match my phone']);
    expect(within(group).getByRole('radio', { name: 'Match my phone' })).toBeChecked();
  });
});

describe('persistence', () => {
  it('saves the theme at once, applies it to the page, and keeps it after Done', async () => {
    renderApp(services);
    await goToLook();

    fireEvent.click(screen.getByRole('radio', { name: 'Sepia' }));
    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('sepia'));
    await waitFor(async () => expect(await getSetting(db, 'appTheme')).toBe('sepia'));
    expect(screen.getByRole('radio', { name: 'Sepia' })).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: 'Black' }));
    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('black'));
    await waitFor(async () => expect(await getSetting(db, 'appTheme')).toBe('black'));

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByTestId('pn-tabbar')).toBeInTheDocument();
    expect(document.documentElement.dataset['theme']).toBe('black');
    expect(await getSetting(db, 'onboardingDone')).toBe(true);
  });

  it('saves the text size, shows it in the live preview and in the CSS variable', async () => {
    renderApp(services);
    await goToLook();
    const slider = screen.getByRole('slider', { name: /text size/i });
    expect(slider).toHaveAttribute('min', String(FONT_SIZE_MIN));
    expect(slider).toHaveAttribute('max', String(FONT_SIZE_MAX));
    expect(slider).toHaveValue(String(FONT_SIZE_DEFAULT));
    expect(document.documentElement.style.getPropertyValue('--pn-font-size')).toBe('16px');

    fireEvent.change(slider, { target: { value: '22' } });
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--pn-font-size')).toBe('22px'));
    // The preview is 1rem, so it is exactly the app text size the slider just set.
    expect(screen.getByTestId('font-preview').className).toContain('text-[length:1rem]');
    await waitFor(async () => expect(await getSetting(db, 'fontSizePx')).toBe(22));
  });

  it('never shows again after Done, even after a fresh start', async () => {
    renderApp(services);
    await goToLook();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await screen.findByTestId('pn-tabbar');
    await waitFor(async () => expect(await getSetting(db, 'onboardingDone')).toBe(true));
    cleanup();

    resetSettings(); // simulates a new page load: store is empty, Dexie keeps the data
    renderApp(services);
    expect(await screen.findByTestId('pn-tabbar')).toBeInTheDocument();
    expect(screen.queryByText(/Step \d of 3/)).not.toBeInTheDocument();
  });

  it('Skip ends onboarding from the first card, keeps defaults, and never shows again', async () => {
    renderApp(services);
    await heading(/no account/i);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(await screen.findByTestId('pn-tabbar')).toBeInTheDocument();
    await waitFor(async () => expect(await getSetting(db, 'onboardingDone')).toBe(true));
    expect(await getSetting(db, 'appTheme')).toBeUndefined();
    cleanup();

    resetSettings();
    renderApp(services);
    expect(await screen.findByTestId('pn-tabbar')).toBeInTheDocument();
  });

  it('Skip from card 2 keeps a theme chosen earlier in the session', async () => {
    renderApp(services);
    await goToLook();
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await heading('A home for your books');
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await screen.findByTestId('pn-tabbar');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    await waitFor(async () => expect(await getSetting(db, 'appTheme')).toBe('dark'));
  });

  it('moves focus to the main area when onboarding ends', async () => {
    renderApp(services);
    await heading(/no account/i);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await screen.findByTestId('pn-tabbar');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Library' })).toHaveFocus());
  });

  it('restores a saved text size and theme on start, and clamps a bad size', async () => {
    await db.settings.bulkPut([
      { key: 'onboardingDone', value: true },
      { key: 'fontSizePx', value: 99 },
      { key: 'appTheme', value: 'dark' },
    ]);
    renderApp(services);
    await screen.findByTestId('pn-tabbar');
    expect(useSettings.getState().fontSizePx).toBe(FONT_SIZE_MAX);
    expect(document.documentElement.style.getPropertyValue('--pn-font-size')).toBe(`${FONT_SIZE_MAX}px`);
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('ignores a damaged text size or done flag', async () => {
    await db.settings.bulkPut([
      { key: 'onboardingDone', value: 'yes' },
      { key: 'fontSizePx', value: 'big' },
    ]);
    renderApp(services);
    await heading(/no account/i);
    expect(useSettings.getState().fontSizePx).toBe(FONT_SIZE_DEFAULT);
    expect(useSettings.getState().onboardingDone).toBe(false);
  });
});

describe('keyboard and small screens', () => {
  it('reaches every control with Tab in a sensible order on the last card', async () => {
    renderApp(services);
    await goToLook();
    // Only the chosen theme is in the tab order (arrow keys move inside the group), then the slider and the buttons.
    const tabbable = Array.from(document.querySelectorAll<HTMLElement>('button, input, [tabindex]')).filter((el) => el.tabIndex >= 0 && !(el instanceof HTMLInputElement && el.type === 'radio' && !el.checked)); // browsers tab into a radio group once, at the chosen radio
    const labels = tabbable.map((el) => el.getAttribute('aria-label') ?? (el as HTMLInputElement).labels?.[0]?.textContent ?? el.textContent);
    expect(labels).toEqual(['Match my phone', 'Smaller text', 'Text size', 'Larger text', 'Back', 'Done']);
  });

  it('uses the design system buttons, which are 44 px tall at least', async () => {
    renderApp(services);
    await heading(/no account/i);
    for (const button of screen.getAllByRole('button')) expect(button.className).toContain('pn-btn');
  });

  it('uses a single column that fits 360 px', async () => {
    renderApp(services);
    await heading(/no account/i);
    const main = screen.getByRole('main');
    expect(main.className).toContain('max-w-md');
    expect(main.className).toContain('w-full');
    expect(main.className).toContain('px-[var(--pn-margin)]');
  });
});

describe('settings screen', () => {
  it('exposes the same text size control, wired to the same saved value', async () => {
    await db.settings.put({ key: 'onboardingDone', value: true });
    renderApp(services, { path: '/settings' });
    const slider = await screen.findByRole('slider', { name: /text size/i });
    fireEvent.change(slider, { target: { value: '20' } });
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--pn-font-size')).toBe('20px'));
    await waitFor(async () => expect(await getSetting(db, 'fontSizePx')).toBe(20));
    expect(useSettings.getState().fontSizePx).toBe(20);
  });
});
