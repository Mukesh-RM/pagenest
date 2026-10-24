import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportResult, SampleBookProvider } from '@/app/contracts';
import { pathForBook } from './route-paths';
import { SampleBookCard } from './components/SampleBookCard';
import { makeServices, renderApp, resetSettings } from './test-utils';
import { setSetting } from '@/data/settings';
import type { AppServices } from './services-context';

function fakeProvider(overrides: Partial<SampleBookProvider> = {}): SampleBookProvider & { importSample: ReturnType<typeof vi.fn> } {
  return {
    info: { title: 'Pride and Prejudice', author: 'Jane Austen', license: 'Public domain', provenance: 'Project Gutenberg, ebook 1342' },
    available: () => true,
    importSample: vi.fn(async (): Promise<ImportResult> => ({ bookId: 'sample-1', kind: 'ebook', title: 'Pride and Prejudice', alreadyInLibrary: false })),
    ...overrides,
  } as SampleBookProvider & { importSample: ReturnType<typeof vi.fn> };
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function CardPage({ provider }: { provider: SampleBookProvider }) {
  const navigate = useNavigate();
  return <SampleBookCard provider={provider} onImported={(r) => navigate(pathForBook({ id: r.bookId, kind: r.kind }))} />;
}

function renderCard(provider: SampleBookProvider) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<CardPage provider={provider} />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SampleBookCard', () => {
  it('shows what the sample is, including license and provenance', () => {
    renderCard(fakeProvider());
    expect(screen.getByRole('region', { name: 'Try a sample book' })).toBeInTheDocument();
    expect(screen.getByText(/Jane Austen/)).toBeInTheDocument();
    expect(screen.getByText(/Public domain/)).toBeInTheDocument();
    expect(screen.getByText(/Project Gutenberg, ebook 1342/)).toBeInTheDocument();
  });

  it('tap calls importSample once, even on a double tap, and shows progress', async () => {
    let finish!: (r: ImportResult) => void;
    const provider = fakeProvider({ importSample: vi.fn(() => new Promise<ImportResult>((r) => (finish = r))) });
    renderCard(provider);
    const button = screen.getByRole('button', { name: 'Add the sample book' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(provider.importSample).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Adding to your library…');
    await act(async () => finish({ bookId: 'x', kind: 'ebook', title: 't', alreadyInLibrary: false }));
  });

  it('navigates to the read route of the new book on success', async () => {
    renderCard(fakeProvider());
    fireEvent.click(screen.getByRole('button', { name: 'Add the sample book' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/read/sample-1');
  });

  it('navigates audiobooks to the listen route', async () => {
    renderCard(fakeProvider({ importSample: vi.fn(async () => ({ bookId: 'a1', kind: 'audio' as const, title: 'T', alreadyInLibrary: true })) }));
    fireEvent.click(screen.getByRole('button', { name: 'Add the sample book' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/listen/a1');
  });

  it('shows the error in plain words, stays on the screen, and lets the person try again', async () => {
    const importSample = vi
      .fn()
      .mockRejectedValueOnce(new Error('Could not add the sample book. Check your connection.'))
      .mockResolvedValueOnce({ bookId: 'ok', kind: 'ebook', title: 'T', alreadyInLibrary: false });
    renderCard(fakeProvider({ importSample }));
    fireEvent.click(screen.getByRole('button', { name: 'Add the sample book' }));
    expect(await screen.findByText('Could not add the sample book. Check your connection.')).toBeInTheDocument();
    expect(screen.queryByTestId('where')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/read/ok');
    expect(importSample).toHaveBeenCalledTimes(2);
  });

  it('uses a fallback message when the error has none', async () => {
    renderCard(fakeProvider({ importSample: vi.fn().mockRejectedValue('boom') }));
    fireEvent.click(screen.getByRole('button', { name: 'Add the sample book' }));
    expect(await screen.findByText('Could not add the sample book. Please try again.')).toBeInTheDocument();
  });

  it('keeps the same card height class and button width in every state', async () => {
    const { container } = renderCard(fakeProvider({ importSample: vi.fn().mockRejectedValue(new Error('x')) }));
    const before = container.innerHTML.match(/min-h-\[\d+px\]/g);
    fireEvent.click(screen.getByRole('button', { name: 'Add the sample book' }));
    await screen.findByText('x');
    expect(container.innerHTML.match(/min-h-\[\d+px\]/g)).toEqual(before);
    expect(screen.getByRole('button', { name: 'Try again' }).className).toContain('pn-btn--block');
  });
});

describe('sample card in the empty Library', () => {
  beforeEach(() => {
    resetSettings();
    localStorage.clear();
  });
  afterEach(() => localStorage.clear());

  async function launch(extra: Partial<AppServices> = {}) {
    const services = { ...makeServices('sample-lib'), ...extra };
    await setSetting(services.db, 'onboardingDone', true);
    return services;
  }

  it('is hidden without a provider', async () => {
    const services = await launch();
    renderApp(services);
    await screen.findByText('Your shelf is waiting');
    expect(screen.queryByText('Try a sample book')).toBeNull();
    services.db.close();
  });

  it('is hidden when the provider says it is not available', async () => {
    const services = await launch({ sampleBook: fakeProvider({ available: () => false }) });
    renderApp(services);
    await screen.findByText('Your shelf is waiting');
    expect(screen.queryByText('Try a sample book')).toBeNull();
    services.db.close();
  });

  it('shows for an available provider and opens the imported book on tap', async () => {
    const provider = fakeProvider();
    const services = await launch({ sampleBook: provider });
    // The "import" really adds the book, as the Library's implementation would.
    provider.importSample.mockImplementation(async () => {
      await services.db.books.add({ id: 'sample-1', fingerprint: 'fp', kind: 'ebook', format: 'epub', title: 'Pride and Prejudice', author: 'Jane Austen', addedAt: 1, favorite: false, finished: false });
      return { bookId: 'sample-1', kind: 'ebook', title: 'Pride and Prejudice', alreadyInLibrary: false };
    });
    renderApp(services);
    fireEvent.click(await screen.findByRole('button', { name: 'Add the sample book' }));
    expect(provider.importSample).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { level: 1, name: 'Pride and Prejudice' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('note')).toHaveTextContent('The reader arrives in a later release'));
    services.db.close();
  });

  it('is not shown once the library has a book', async () => {
    const services = await launch({ sampleBook: fakeProvider() });
    await services.db.books.add({ id: 'b', fingerprint: 'f', kind: 'pdf', format: 'pdf', title: 'Mine', addedAt: 1, favorite: false, finished: false });
    renderApp(services);
    await screen.findByText('Mine');
    expect(screen.queryByText('Try a sample book')).toBeNull();
    services.db.close();
  });
});
