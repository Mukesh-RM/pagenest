import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSetting } from '@/data/settings';
import { createLibraryProvider, SAMPLE_INFO } from '@/features/library';
import { resetImportController, setImportBackend } from '@/features/library/registry';
import { polyfillBlob } from '@/features/library/testing/blob-polyfill';
import { inProcessBackend } from '@/features/library/testing/in-process-backend';
import { ServicesProvider } from './services';
import { useServices, type AppServices } from './services-context';
import { makeServices, renderApp, resetSettings } from './test-utils';

function Capture({ into }: { into: { value?: AppServices } }) {
  into.value = useServices();
  return null;
}

describe('services: the Library provider is registered', () => {
  it('registers one object as both the importer and the sample book, from @/features/library', () => {
    const got: { value?: AppServices } = {};
    render(
      <ServicesProvider>
        <Capture into={got} />
      </ServicesProvider>,
    );
    const { importer, sampleBook } = got.value ?? {};
    expect(importer).toBeDefined();
    expect(sampleBook).toBeDefined();
    expect(importer).toBe(sampleBook);
    expect(sampleBook?.info).toEqual(SAMPLE_INFO);
    expect(importer?.accept).toBe('*/*'); // content decides the format, never the file name
    // Both say the same thing about whether import can run here (jsdom has no Worker).
    expect(importer?.available()).toBe(sampleBook?.available());
  });

  it('a services object passed in (tests) is used as given, nothing is added to it', () => {
    const given = makeServices('integration-given');
    const got: { value?: AppServices } = {};
    render(
      <ServicesProvider services={given}>
        <Capture into={got} />
      </ServicesProvider>,
    );
    expect(got.value).toBe(given);
    expect(got.value?.importer).toBeUndefined();
    given.db.close();
  });
});

describe('route / is the Library screen from @/features/library', () => {
  let services: AppServices;
  beforeEach(async () => {
    resetSettings();
    localStorage.clear();
    services = makeServices('integration-route');
    await setSetting(services.db, 'onboardingDone', true);
  });
  afterEach(() => services.db.close());

  it('shows the Library toolbar, the Add button and the windowed list for books in the database', async () => {
    await services.db.books.add({
      id: 'b1',
      fingerprint: 'f1',
      kind: 'ebook',
      format: 'epub',
      title: 'The Long Road',
      author: 'Ann Lee',
      addedAt: 1,
      favorite: false,
      finished: false,
    });
    renderApp(services);
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'The Long Road, by Ann Lee, book' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('status').some((s) => s.textContent === '1 book')).toBe(true));
  });

  it('shows the sample card on an empty library when the registered provider can run, and no dead card when it cannot', async () => {
    const withSample: AppServices = {
      ...services,
      sampleBook: {
        info: SAMPLE_INFO,
        available: () => true,
        importSample: async () => ({ bookId: 's', kind: 'ebook', format: 'epub', title: 'T', alreadyInLibrary: false }),
      },
    };
    const first = renderApp(withSample);
    expect(await screen.findByRole('region', { name: 'Try a sample book' })).toBeInTheDocument();
    first.unmount();
    renderApp({ ...services, sampleBook: { ...withSample.sampleBook!, available: () => false } });
    await screen.findByText('Your shelf is waiting');
    expect(screen.queryByRole('region', { name: 'Try a sample book' })).toBeNull();
  });
});

describe('first launch to the sample book on the real Library provider (in-process import backend)', () => {
  const epub = readFileSync(resolve(process.cwd(), 'src/features/library/sample/peter-rabbit.epub'));
  let services: AppServices;
  beforeAll(polyfillBlob);
  beforeEach(() => {
    resetSettings();
    localStorage.clear();
    services = makeServices('integration-first-launch');
    resetImportController();
    setImportBackend(() => inProcessBackend(services.db));
  });
  afterEach(async () => {
    resetImportController();
    services.db.close();
  });

  it('Next, then Open a sample book imports the real EPUB and opens it in the reader', async () => {
    const fetchFn = vi.fn(async () => new Response(new Blob([new Uint8Array(epub)])));
    const library = createLibraryProvider({ fetchFn, canRun: () => true });
    renderApp({ ...services, importer: library, sampleBook: library });
    await screen.findByRole('heading', { level: 1, name: /Your books, your voice/ });
    expect(fetchFn).not.toHaveBeenCalled(); // nothing is downloaded until the tap
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { level: 1, name: 'A home for your books' });
    fireEvent.click(screen.getByRole('button', { name: 'Open a sample book' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Tale of Peter Rabbit' }, { timeout: 15000 })).toBeInTheDocument();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const rows = await services.db.books.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: 'The Tale of Peter Rabbit', author: 'Beatrix Potter', format: 'epub', kind: 'ebook' });
  }, 30000);

  it('after Skip, the Library offers the sample card and a second tap path works (two taps in all)', async () => {
    const library = createLibraryProvider({ fetchFn: vi.fn(async () => new Response(new Blob([new Uint8Array(epub)]))), canRun: () => true });
    renderApp({ ...services, importer: library, sampleBook: library });
    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add the sample book' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Tale of Peter Rabbit' }, { timeout: 15000 })).toBeInTheDocument();
  }, 30000);
});
