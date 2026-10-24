import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ResumeInfo } from '@/data/resume';
import { ResumeCard, ResumeCardSkeleton } from './components/ResumeCard';
import { hadResumeCard, rememberResumeCard } from './resume-hint';
import { LibraryPage } from './pages/LibraryPage';
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

describe('ResumeCard', () => {
  it('says Welcome back with the chapter, book and progress', () => {
    render(<ResumeCard info={info} />);
    expect(screen.getByRole('region', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByText('Welcome back, chapter 7')).toBeInTheDocument();
    expect(screen.getByText('The Storm · The Long Road Home')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Continue position in The Long Road Home' })).toBeInTheDocument();
  });

  it('has no control at all when there is no route to open (information only, nothing dead)', () => {
    render(<ResumeCard info={info} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('is a real link when it is given a route', () => {
    render(
      <MemoryRouter>
        <ResumeCard info={info} href="/read/b1" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Welcome back, chapter 7/ })).toHaveAttribute('href', '/read/b1');
  });

  it('drops the chapter when unknown', () => {
    render(<ResumeCard info={{ ...info, chapterNumber: undefined, chapterTitle: undefined } as unknown as ResumeInfo} />);
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByText('The Long Road Home')).toBeInTheDocument();
  });

  it('uses the headphones for listening', () => {
    const { container } = render(<ResumeCard info={{ ...info, mode: 'listen' }} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('skeleton has the same fixed height as the card', () => {
    const { container: a } = render(<ResumeCardSkeleton />);
    const { container: b } = render(<ResumeCard info={info} />);
    expect(a.innerHTML).toContain('min-h-[88px]');
    expect(b.innerHTML).toContain('min-h-[88px]');
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
    await screen.findByText('Your shelf is waiting');
    expect(screen.queryByText(/Welcome back/)).toBeNull();
    services.db.close();
  });

  it('shows the last-read book and chapter from the saved progress, linking to its real route', async () => {
    const services = await launch();
    await services.db.books.add({ id: 'b1', fingerprint: 'f', kind: 'ebook', format: 'epub', title: 'The Long Road Home', addedAt: 1, favorite: false, finished: false });
    await services.db.chapters.bulkAdd([
      { bookId: 'b1', index: 0, title: 'Start', locator: { kind: 'reflow', section: 0, textOffset: 0 } },
      { bookId: 'b1', index: 6, title: 'The Storm', locator: { kind: 'reflow', section: 6, textOffset: 0 } },
    ]);
    await services.progress.save('b1', 'read', { kind: 'reflow', section: 6, textOffset: 20 }, 55);
    renderApp(services);
    expect(await screen.findByText('Welcome back, chapter 7')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Welcome back, chapter 7/ })).toHaveAttribute('href', '/read/b1');
    await waitFor(() => expect(hadResumeCard()).toBe(true));
    services.db.close();
  });

  it('appears when progress is saved while the Library is open, and goes when the book is finished', async () => {
    const services = await launch();
    await services.db.books.add({ id: 'b1', fingerprint: 'f', kind: 'ebook', format: 'epub', title: 'Quiet Book', addedAt: 1, favorite: false, finished: false });
    renderApp(services);
    await screen.findByText('Quiet Book');
    expect(screen.queryByText(/Welcome back/)).toBeNull();
    await services.progress.save('b1', 'read', { kind: 'reflow', section: 0, textOffset: 5 }, 12);
    expect(await screen.findByText('Welcome back')).toBeInTheDocument();
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
          <LibraryPage />
        </ServicesProvider>
      </MemoryRouter>,
    );
    expect(container.innerHTML).toContain('min-h-[88px]');
    await screen.findByText('Your shelf is waiting');
    services.db.close();
  });
});
