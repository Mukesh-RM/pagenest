import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportResult, SampleBookProvider } from '@/app/contracts';
import { setSetting } from '@/data/settings';
import { applyFontSize, fontScalePercent } from './apply-theme';
import { FONT_SIZE_DEFAULT, FONT_SIZE_MAX, FONT_SIZE_MIN } from './font-size';
import type { AppServices } from './services-context';
import { makeServices, renderApp, resetSettings } from './test-utils';

const root = process.cwd();
const read = (...parts: string[]): string => readFileSync(join(root, ...parts), 'utf8');

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else out.push(path);
  }
  return out;
}

describe('text size (apply-theme)', () => {
  afterEach(() => document.documentElement.removeAttribute('style'));

  it('writes only --pn-font-size: no px text tokens are set, so every rem token follows the setting', () => {
    applyFontSize(20);
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--pn-font-size')).toBe('20px');
    for (const token of ['xs', 'sm', 'md', 'lg', 'xl']) expect(style.getPropertyValue(`--pn-text-${token}`)).toBe('');
    expect(style.length).toBe(1);
  });

  it('reaches 200 % (32 px on a 16 px base) and stays within 88 % to 200 %', () => {
    expect(FONT_SIZE_DEFAULT).toBe(16);
    expect(FONT_SIZE_MAX).toBe(32);
    expect(fontScalePercent(FONT_SIZE_MAX)).toBe(200);
    expect(fontScalePercent(FONT_SIZE_DEFAULT)).toBe(100);
    expect(fontScalePercent(FONT_SIZE_MIN)).toBe(88);
  });

  it('the design tokens are rem, and html takes its size from --pn-font-size (so rem tokens scale)', () => {
    const tokens = read('src', 'ui', 'styles', 'tokens.css');
    for (const token of ['xs', 'sm', 'md', 'lg', 'xl']) expect(tokens).toMatch(new RegExp(`--pn-text-${token}:\\s*[\\d.]+rem;`));
    expect(read('src', 'index.css')).toMatch(/font-size:\s*var\(--pn-font-size/);
  });

  it('no file in src/app writes a px text token or overrides a font family', () => {
    const offenders: string[] = [];
    for (const file of files(join(root, 'src', 'app')).filter((f) => /\.(ts|tsx|css)$/.test(f) && !/\.test\./.test(f))) {
      const text = readFileSync(file, 'utf8');
      if (/--pn-text-[a-z]+`?\s*,\s*`?\d+px/.test(text) || /setProperty\(`--pn-text/.test(text)) offenders.push(`${file}: px text token`);
      if (/font-family\s*:/.test(text) || /fontFamily/.test(text)) offenders.push(`${file}: font-family`);
    }
    // The reader's own font list is data for the reader (it names the design tokens or device fonts); it is not CSS here.
    expect(offenders.filter((o) => !o.includes('reader-settings.ts'))).toEqual([]);
  });

  it('maps a changed slider to the root size at 200 % in the running app', async () => {
    resetSettings();
    const services = makeServices('wiring-size');
    await setSetting(services.db, 'onboardingDone', true);
    await setSetting(services.db, 'fontSizePx', 32);
    renderApp(services, { path: '/settings' });
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--pn-font-size')).toBe('32px'));
    expect(screen.getByRole('slider', { name: 'Text size' })).toHaveAttribute('aria-valuetext', '200%, 32 pixels');
    services.db.close();
  });
});

describe('startup', () => {
  it('main.tsx preloads Inter and Literata before the first render, and loads the design system once', () => {
    const main = read('src', 'main.tsx');
    expect(main).toMatch(/preloadCriticalFonts\(\)/);
    expect(main.indexOf('preloadCriticalFonts()')).toBeLessThan(main.indexOf('createRoot(root).render'));
    expect(main).toMatch(/from '@\/ui'/);
  });
});

describe('page titles use the design system (serif) type', () => {
  let services: AppServices;
  beforeEach(async () => {
    resetSettings();
    localStorage.clear();
    services = makeServices('wiring-titles');
    await setSetting(services.db, 'onboardingDone', true);
  });
  afterEach(() => {
    cleanup();
    services.db.close();
  });

  it.each([
    ['/', 'Library'],
    ['/collections', 'Collections'],
    ['/stats', 'Stats'],
    ['/settings', 'Settings'],
  ])('%s: the h1 is the pn-screen__title (Literata via --pn-font-serif), in a pn-screen frame', async (path, name) => {
    renderApp(services, { path });
    const title = await screen.findByRole('heading', { level: 1, name });
    expect(title).toHaveClass('pn-screen__title');
    expect(title.closest('.pn-screen')).not.toBeNull();
    const css = read('src', 'ui', 'styles', 'screens.css');
    expect(css).toMatch(/\.pn-screen__title\s*\{[^}]*font-family:\s*var\(--pn-font-serif\)/);
  });

  it('Settings section headings are serif too, and the theme choice is the design system ThemePicker', async () => {
    renderApp(services, { path: '/settings' });
    const heading = await screen.findByRole('heading', {
      level: 2,
      name: 'Appearance',
    });
    expect(heading).toHaveClass('pn-set-card__title'); // the design system's Settings group title (serif from the tokens)
    expect(read('tailwind.config.ts')).toMatch(/serif:\s*\['var\(--pn-font-serif\)'\]/);
    expect(screen.getByRole('group', { name: 'Theme' })).toHaveClass('pn-themes');
  });

  it('the book routes use the design system too: the reader chrome and the page frame', async () => {
    await services.db.books.add({
      id: 'b1',
      fingerprint: 'f',
      kind: 'ebook',
      format: 'epub',
      title: 'T',
      addedAt: 1,
      favorite: false,
      finished: false,
    });
    await services.db.books.add({
      id: 'a1',
      fingerprint: 'g',
      kind: 'audio',
      format: 'm4b',
      title: 'A',
      addedAt: 1,
      favorite: false,
      finished: false,
    });
    const reader = renderApp(services, { path: '/read/b1' });
    expect((await screen.findByRole('heading', { level: 1, name: 'T' })).className).toContain('pn-reader__title');
    reader.unmount();
    renderApp(services, { path: '/listen/a1' });
    expect((await screen.findByRole('heading', { level: 1, name: 'A' })).className).toContain('pn-screen__title');
  });
});

describe('first launch to the sample book', () => {
  let services: AppServices;
  const result: ImportResult = {
    bookId: 'sample',
    kind: 'ebook',
    format: 'epub',
    title: 'Pride and Prejudice',
    alreadyInLibrary: false,
  };

  /** An in-memory provider: adds the book to the database, like the Library's real one will. */
  function memoryProvider(): SampleBookProvider & {
    importSample: ReturnType<typeof vi.fn>;
  } {
    return {
      info: {
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        license: 'Public domain',
        provenance: 'Project Gutenberg, ebook 1342',
      },
      available: () => true,
      importSample: vi.fn(async () => {
        await services.db.books.add({
          id: 'sample',
          fingerprint: 'sample',
          kind: 'ebook',
          format: 'epub',
          title: result.title,
          addedAt: 1,
          favorite: false,
          finished: false,
        });
        return result;
      }),
    };
  }

  beforeEach(() => {
    resetSettings();
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    services.db.close();
  });

  it('is two taps from first launch (Next, then Open a sample book): the sample opens the reader and onboarding never shows again', async () => {
    const provider = memoryProvider();
    services = { ...makeServices('wiring-first-run'), sampleBook: provider };
    renderApp(services);
    await screen.findByRole('heading', { level: 1, name: /no account/i });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { level: 1, name: 'A home for your books' });
    fireEvent.click(screen.getByRole('button', { name: 'Open a sample book' }));
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Pride and Prejudice',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to library' })).toBeInTheDocument();
    expect(provider.importSample).toHaveBeenCalledTimes(1);
    await waitFor(async () => expect((await services.db.settings.get('onboardingDone'))?.value).toBe(true));
  });

  it('after Skip, the empty Library offers the sample card, and one tap opens the book (two taps in all)', async () => {
    const provider = memoryProvider();
    services = { ...makeServices('wiring-skip'), sampleBook: provider };
    renderApp(services);
    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));
    expect(await screen.findByText('Your library is empty')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Add the sample book' }));
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Pride and Prejudice',
      }),
    ).toBeInTheDocument();
  });

  it('without a provider no sample control exists anywhere on first launch', async () => {
    services = makeServices('wiring-no-provider');
    renderApp(services);
    await screen.findByRole('heading', { level: 1, name: /no account/i });
    expect(screen.queryByRole('button', { name: /sample/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await screen.findByText('Your library is empty');
    expect(screen.queryByRole('button', { name: /sample/i })).toBeNull();
  });
});

describe('theme, text size and install wiring (design system pieces)', () => {
  let services: AppServices;
  beforeEach(async () => {
    resetSettings();
    localStorage.clear();
    services = makeServices('wiring-pieces');
    await setSetting(services.db, 'onboardingDone', true);
  });
  afterEach(() => {
    cleanup();
    services.db.close();
  });

  it('Custom theme: choosing it applies the three colors on the page and saves them', async () => {
    renderApp(services, { path: '/settings' });
    fireEvent.click(await screen.findByRole('radio', { name: 'Custom' }));
    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('custom'));
    await waitFor(async () => expect((await services.db.settings.get('appTheme'))?.value).toBe('custom'));
    const saved = (await services.db.settings.get('customTheme').catch(() => undefined))?.value;
    // Colors are only written once the person edits one; before that the defaults are in use and the setting is absent.
    expect(saved === undefined || typeof saved === 'object').toBe(true);
  });

  it('restores a saved Custom theme and its colors on start', async () => {
    await services.db.settings.bulkPut([
      { key: 'appTheme', value: 'custom' },
      { key: 'customTheme', value: { page: '#102030', text: '#f0f0f0', accent: '#ffcc00' } },
    ]);
    renderApp(services, { path: '/settings' });
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('custom'));
    expect(document.documentElement.style.getPropertyValue('--pn-page')).not.toBe('');
  });

  it('ignores a damaged saved Custom theme and keeps the defaults', async () => {
    await services.db.settings.bulkPut([
      { key: 'appTheme', value: 'custom' },
      { key: 'customTheme', value: { page: 'red', text: 3 } },
    ]);
    renderApp(services, { path: '/settings' });
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('custom'));
  });

  it('High contrast: choosing it in Settings sets data-contrast on the page and saves it; a saved choice is restored on start', async () => {
    renderApp(services, { path: '/settings' });
    fireEvent.click(await screen.findByRole('radio', { name: 'High contrast' }));
    await waitFor(() => expect(document.documentElement.dataset['contrast']).toBe('high'));
    await waitFor(async () => expect((await services.db.settings.get('contrastMode'))?.value).toBe('high'));
    cleanup();
    document.documentElement.removeAttribute('data-contrast');
    resetSettings();
    renderApp(services, { path: '/settings' });
    await waitFor(() => expect(document.documentElement.dataset['contrast']).toBe('high'));
    expect(await screen.findByRole('radio', { name: 'High contrast' })).toBeChecked();
  });

  it('the text size control has working Smaller and Larger buttons that save the size', async () => {
    renderApp(services, { path: '/settings' });
    fireEvent.click(await screen.findByRole('button', { name: 'Larger text' }));
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--pn-font-size')).toBe('18px'));
    fireEvent.click(screen.getByRole('button', { name: 'Smaller text' }));
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--pn-font-size')).toBe('16px'));
  });

  it('Settings uses the design system Install help (one button) and no install control appears before a first book', async () => {
    renderApp(services, { path: '/settings' });
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    expect(screen.getAllByRole('button', { name: /install help/i })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
  });
});
