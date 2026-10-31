import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('card 2 offers "Add your book" and the sample only when the Library provider can run (no dead controls)', async () => {
    const importer: AppServices['importer'] = { accept: '*/*', available: () => true, importFiles: async () => [] };
    const sampleBook: AppServices['sampleBook'] = {
      info: { title: 'T', author: 'A', license: 'Public domain', provenance: 'P' },
      available: () => true,
      importSample: async () => ({ bookId: 'x', kind: 'ebook', format: 'epub', title: 'T', alreadyInLibrary: false }),
    };
    const first = renderApp({ ...services, importer, sampleBook });
    await heading(/no account/i);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await heading('A home for your books');
    expect(screen.getByRole('button', { name: 'Add your book' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open a sample book' })).toBeInTheDocument();
    first.unmount();
    renderApp(services); // no provider registered
    await heading(/no account/i);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await heading('A home for your books');
    expect(screen.queryByRole('button', { name: 'Add your book' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open a sample book' })).toBeNull();
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
    expect(screen.getByText(/works without internet/i)).toBeInTheDocument();
    // with no Library provider registered, card 2 has no add-book control: only navigation buttons exist
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
    // The preview uses the design system's sample style (inherits the app text size the slider just set).
    expect(screen.getByTestId('font-preview').className).toContain('pn-set-card__sample');
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

  it('uses the design system onboarding frame (one column, safe areas, bottom actions)', async () => {
    renderApp(services);
    await heading(/no account/i);
    const main = screen.getByRole('main');
    expect(main.className).toContain('pn-onb');
    expect(main.querySelector('.pn-onb__footer')).not.toBeNull();
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

describe('onboarding on the design system screen: sample book and Add your book', () => {
  const info = { title: 'Peter', author: 'B. Potter', license: 'Public domain', provenance: 'Project Gutenberg, ebook 14838' };
  const result = { bookId: 'peter', kind: 'ebook' as const, format: 'epub' as const, title: 'Peter', alreadyInLibrary: false };
  /** Like the real provider, the sample is in the database by the time it reports success. */
  const addPeter = async (): Promise<typeof result> => {
    await db.books.add({ id: 'peter', fingerprint: 'peter', kind: 'ebook', format: 'epub', title: 'Peter', addedAt: 1, favorite: false, finished: false });
    return result;
  };
  const toCard2 = async (): Promise<void> => {
    await heading(/no account/i);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await heading('A home for your books');
  };

  it('Open a sample book imports once even on a double tap, finishes onboarding and opens the book', async () => {
    let finish!: () => void;
    const importSample = vi.fn(() => new Promise<typeof result>((r) => (finish = () => void addPeter().then(r))));
    renderApp({ ...services, sampleBook: { info, available: () => true, importSample } });
    await toCard2();
    const open = screen.getByRole('button', { name: 'Open a sample book' });
    fireEvent.click(open);
    fireEvent.click(open);
    expect(importSample).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Adding…' })).toBeDisabled();
    finish();
    expect(await screen.findByRole('heading', { level: 1, name: 'Peter' })).toBeInTheDocument();
    await waitFor(async () => expect(await getSetting(db, 'onboardingDone')).toBe(true));
  });

  it('a failed sample shows the plain-words message and Try again, and stays on onboarding', async () => {
    const importSample = vi.fn().mockRejectedValueOnce(new Error('Could not add the sample book. Check your connection and try again.')).mockImplementation(addPeter);
    renderApp({ ...services, sampleBook: { info, available: () => true, importSample } });
    await toCard2();
    fireEvent.click(screen.getByRole('button', { name: 'Open a sample book' }));
    expect(await screen.findByText(/Check your connection/)).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Peter' })).toBeInTheDocument();
  });

  it('Add your book opens the file picker; a book that was added finishes onboarding and shows the Library', async () => {
    const importFiles = vi.fn(async (files: readonly File[]) => files.map((f) => ({ fileName: f.name, result })));
    const importer = { accept: '*/*', available: () => true, importFiles };
    const { container } = renderApp({ ...services, importer });
    await toCard2();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Add your book' }));
    expect(click).toHaveBeenCalledTimes(1);
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.epub')] } });
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument();
    expect(importFiles).toHaveBeenCalledTimes(1);
    await waitFor(async () => expect(await getSetting(db, 'onboardingDone')).toBe(true));
  });

  it('when nothing could be added, the importer plain words are shown and onboarding stays', async () => {
    const importer = { accept: '*/*', available: () => true, importFiles: async (files: readonly File[]) => files.map((f) => ({ fileName: f.name, error: 'This file is protected, so InkQuiet cannot open it.' })) };
    const { container } = renderApp({ ...services, importer });
    await toCard2();
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [new File(['x'], 'a.epub')] } });
    expect(await screen.findByText(/protected, so InkQuiet cannot open it/)).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
  });

  it('Skip and Done keep the chosen look and finish onboarding', async () => {
    renderApp(services);
    await goToLook();
    fireEvent.click(screen.getByRole('radio', { name: 'Sepia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByTestId('pn-tabbar')).toBeInTheDocument();
    expect(document.documentElement.dataset['theme']).toBe('sepia');
    expect(await getSetting(db, 'onboardingDone')).toBe(true);
  });
});
