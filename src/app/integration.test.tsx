import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setSetting } from '@/data/settings';
import { SAMPLE_INFO } from '@/features/library';
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
