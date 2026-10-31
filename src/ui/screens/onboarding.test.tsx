import '../test/setup';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { listUiFiles, readUiFile } from '../test/css';
import { FirstRunBooks } from '../components/FirstRunBooks';
import type { StarterBookOffer } from '../components/StarterBookCard';
import { LibraryScreen } from './LibraryScreen';
import { OnboardingScreen } from './OnboardingScreen';

const offer = (over: Partial<StarterBookOffer> = {}): StarterBookOffer => ({
  title: 'Pride and Prejudice',
  author: 'Jane Austen',
  license: 'Public domain',
  provenance: 'Project Gutenberg, ebook 1342',
  onOpen: vi.fn(),
  ...over,
});

function Harness({ starter, onAddBooks }: { starter?: StarterBookOffer; onAddBooks?: () => void }) {
  const [step, setStep] = useState(0);
  return (
    <OnboardingScreen
      step={step}
      onNext={() => setStep(step + 1)}
      onBack={() => setStep(step - 1)}
      onSkip={vi.fn()}
      onDone={vi.fn()}
      starter={starter}
      onAddBooks={onAddBooks}
      look={<p>look controls</p>}
    />
  );
}

describe('OnboardingScreen', () => {
  it('keeps the contract the app and QA rely on: headings, step text, Skip on the first two cards, Done on the last', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('heading', { level: 1, name: /your books, your voice, no account/i })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'A home for your books' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Pick a look' })).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.getByText('look controls')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
  });

  it('puts the actions in a footer after the card, so they sit at the bottom', () => {
    render(<Harness />);
    const footer = screen.getByRole('button', { name: 'Next' }).closest('footer')!;
    expect(footer).toHaveClass('pn-onb__footer');
    expect(footer.previousElementSibling).toHaveClass('pn-onb__card');
  });

  it('card 2 offers the sample book and Add your book, and first-book buttons call back', async () => {
    const user = userEvent.setup();
    const add = vi.fn();
    const sample = offer();
    render(<Harness starter={sample} onAddBooks={add} />);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    const card = screen.getByRole('region', { name: 'Try a sample book' });
    expect(within(card).getByRole('heading', { name: 'Pride and Prejudice' })).toBeInTheDocument();
    expect(within(card).getByText(/public domain\. project gutenberg, ebook 1342\./i)).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Open a sample book' }));
    expect(sample.onOpen).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Add your book' }));
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('never invents a sample book: without an offer there is no card', async () => {
    const user = userEvent.setup();
    render(<Harness onAddBooks={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.queryByRole('region', { name: 'Try a sample book' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add your book' })).toBeInTheDocument();
  });

  it('every card has a designed picture and no card is text only', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    expect(container.querySelector('.pn-appmark')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(container.querySelector('.pn-ill')).not.toBeNull();
  });
});

describe('sample book card states', () => {
  it('shows adding and error states in the same place, with plain words', () => {
    const { rerender } = render(<FirstRunBooks onAdd={vi.fn()} starter={offer({ busy: true })} />);
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Adding it to your library');
    rerender(<FirstRunBooks onAdd={vi.fn()} starter={offer({ error: 'Could not add the sample book. Check your connection and try again.' })} />);
    expect(screen.getByRole('status')).toHaveTextContent('Check your connection');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });
});

describe('Library first run, sort, layout', () => {
  const base = { books: [], filter: 'all', onFilterChange: vi.fn(), query: '', onQueryChange: vi.fn(), onOpenBook: vi.fn(), onAdd: vi.fn() };
  it('an empty library shows the first-run path with the sample', () => {
    render(<LibraryScreen {...base} starter={offer()} />);
    expect(screen.getByRole('button', { name: 'Open a sample book' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add your book' })).toBeInTheDocument();
  });

  it('sort and layout controls appear only when handlers are given and report changes', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const onViewChange = vi.fn();
    const { rerender } = render(<LibraryScreen {...base} />);
    expect(screen.queryByLabelText('Sort by')).toBeNull();
    rerender(<LibraryScreen {...base} sort="recent" onSortChange={onSortChange} view="grid" onViewChange={onViewChange} />);
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'title' } });
    expect(onSortChange).toHaveBeenCalledWith('title');
    expect(screen.getByRole('button', { name: 'Grid of covers' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(onViewChange).toHaveBeenCalledWith('list');
  });
});

describe('copy rules', () => {
  it('no screen or component says features "arrive in the next release or update"', () => {
    const offenders = listUiFiles()
      .filter((f) => /\.(ts|tsx|css)$/.test(f) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'))
      .filter((f) => /arrives? in the next|next (release|update)|coming soon|lorem ipsum/i.test(readUiFile(f)));
    expect(offenders).toEqual([]);
  });
});
