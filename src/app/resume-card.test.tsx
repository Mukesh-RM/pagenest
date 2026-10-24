import { fireEvent, render, screen } from '@testing-library/react';
import { SnackbarProvider } from '@/ui';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResumeInfo } from '@/data/resume';
import { LibraryResume, LibraryResumeSkeleton, RESUME_CARD_HEIGHT_REM } from './components/LibraryResume';
import { hadResumeCard, rememberResumeCard } from './resume-hint';
import { LibraryRoute } from './pages/LibraryRoute';
import { ServicesProvider } from './services';
import { makeServices, renderApp, resetSettings } from './test-utils';
import { setSetting } from '@/data/settings';
import { waitFor } from '@testing-library/react';

const info: ResumeInfo = {
  bookId: 'b1',
  title: 'The Long Road Home',
  author: 'Ann Lee',
  kind: 'ebook',
  mode: 'read',
  locator: { kind: 'reflow', section: 6, textOffset: 0 },
  percent: 61.4,
  chapterNumber: 7,
  chapterTitle: 'The Storm',
  updatedAt: 1,
};

describe('LibraryResume (design system Welcome back card)', () => {
  it('says Welcome back with the chapter, book and progress', () => {
    render(<LibraryResume info={info} onResume={() => undefined} onDismiss={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByText(/chapter 7/)).toBeInTheDocument();
    expect(screen.getByText('The Long Road Home', { selector: '.pn-resume__title' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Reading progress' })).toHaveAttribute('aria-valuenow', '61');
  });

  it('names the place by percent when the book has no chapter info', () => {
    render(
      <LibraryResume
        info={
          {
            ...info,
            chapterNumber: undefined,
            chapterTitle: undefined,
          } as unknown as ResumeInfo
        }
        onResume={() => undefined}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.getByText(/61%/)).toBeInTheDocument();
  });

  it('has exactly two controls and both work: Keep reading resumes, Not now dismisses', () => {
    const onResume = vi.fn();
    const onDismiss = vi.fn();
    render(<LibraryResume info={info} onResume={onResume} onDismiss={onDismiss} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Keep reading', 'Not now']);
    fireEvent.click(screen.getByRole('button', { name: 'Keep reading' }));
    expect(onResume).toHaveBeenCalledWith(info);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('uses listening words for a listening position', () => {
    render(<LibraryResume info={{ ...info, mode: 'listen', kind: 'audio' }} onResume={() => undefined} onDismiss={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Keep listening' })).toBeInTheDocument();
  });

  it('the skeleton reserves the height in rem, so it follows the text size', () => {
    const { container } = render(<LibraryResumeSkeleton />);
    expect((container.firstElementChild as HTMLElement).style.height).toBe(`${RESUME_CARD_HEIGHT_REM}rem`);
  });
});

describe('resume hint', () => {
  beforeEach(() => localStorage.clear());
  it('round-trips', () => {
    expect(hadResumeCard()).toBe(false);
    rememberResumeCard(true);
    expect(hadResumeCard()).toBe(true);
    rememberResumeCard(false);
    expect(hadResumeCard()).toBe(false);
  });
});

describe('Library resume card', () => {
  beforeEach(() => {
    resetSettings();
    localStorage.clear();
  });
  afterEach(() => localStorage.clear());

  async function launch() {
    const services = makeServices('resume-lib');
    await setSetting(services.db, 'onboardingDone', true);
    return services;
  }

  it('is hidden when there is nothing to resume', async () => {
    const services = await launch();
    renderApp(services);
    await screen.findByText('Your library is empty');
    expect(screen.queryByText(/Welcome back/)).toBeNull();
    services.db.close();
  });

  it('shows the last-read book and chapter from the saved progress, linking to its real route', async () => {
    const services = await launch();
    await services.db.books.add({
      id: 'b1',
      fingerprint: 'f',
      kind: 'ebook',
      format: 'epub',
      title: 'The Long Road Home',
      addedAt: 1,
      favorite: false,
      finished: false,
    });
    await services.db.chapters.bulkAdd([
      { bookId: 'b1', index: 0, title: 'Start', locator: { kind: 'reflow', section: 0, textOffset: 0 } },
      { bookId: 'b1', index: 6, title: 'The Storm', locator: { kind: 'reflow', section: 6, textOffset: 0 } },
    ]);
    await services.progress.save('b1', 'read', { kind: 'reflow', section: 6, textOffset: 20 }, 55);
    renderApp(services);
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByText(/chapter 7/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep reading' }));
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'The Long Road Home',
      }),
    ).toBeInTheDocument();
    await waitFor(() => expect(hadResumeCard()).toBe(true));
    services.db.close();
  });

  it('appears when progress is saved while the Library is open, and goes when the book is finished', async () => {
    const services = await launch();
    await services.db.books.add({
      id: 'b1',
      fingerprint: 'f',
      kind: 'ebook',
      format: 'epub',
      title: 'Quiet Book',
      addedAt: 1,
      favorite: false,
      finished: false,
    });
    renderApp(services);
    await screen.findAllByText('Quiet Book');
    expect(screen.queryByText(/Welcome back/)).toBeNull();
    await services.progress.save('b1', 'read', { kind: 'reflow', section: 0, textOffset: 5 }, 12);
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    await services.db.books.update('b1', { finished: true });
    await waitFor(() => expect(screen.queryByText(/Welcome back/)).toBeNull());
    services.db.close();
  });

  it('reserves the card space with a skeleton while loading when the last visit had a card', async () => {
    rememberResumeCard(true);
    const services = await launch();
    const { container } = render(
      <MemoryRouter>
        <ServicesProvider services={services}>
          <SnackbarProvider>
            <LibraryRoute />
          </SnackbarProvider>
        </ServicesProvider>
      </MemoryRouter>,
    );
    expect(container.querySelector('[aria-hidden="true"][style*="rem"]')).not.toBeNull();
    await screen.findByText('Your library is empty');
    services.db.close();
  });
});
