import '../test/setup';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CollectionBooksEmpty } from '../components/CollectionBooksEmpty';
import { CollectionNameSheet } from '../components/CollectionNameSheet';
import { SAMPLE_SHELVES, SAMPLE_WEEK_MINUTES } from '../demo/sample-data';
import { THEME_PALETTE } from '../theme/palette';
import { THEME_NAMES } from '../theme/themes';
import { ThemeProvider } from '../theme';
import { declarationsFor, parseCss, readUiFile } from '../test/css';
import { barShare, minutesLabel, weekFigures } from '../utils/stats';
import { contrastRatio } from '../utils/wcag';
import { CollectionsScreen, type CollectionsScreenProps } from './CollectionsScreen';
import { StatsScreen, type StatsScreenProps } from './StatsScreen';
import * as screensEntry from './index';

const noop = () => undefined;
const wrap = (node: React.ReactNode) => <ThemeProvider mode="light">{node}</ThemeProvider>;

function collections(over: Partial<CollectionsScreenProps> = {}) {
  return wrap(<CollectionsScreen shelves={SAMPLE_SHELVES} onOpenShelf={noop} {...over} />);
}

describe('CollectionsScreen', () => {
  it('has a title, the automatic shelves and your shelves with plain book counts', () => {
    render(collections());
    expect(screen.getByRole('heading', { level: 1, name: 'Collections' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unfinished\. Books you started/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Summer reading, 6 books' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /For the train, 1 book$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /, 0 books$/ })).toBeInTheDocument();
  });

  it('opens a shelf and an automatic shelf', () => {
    const onOpenShelf = vi.fn();
    const onOpenSmart = vi.fn();
    render(collections({ onOpenShelf, onOpenSmart }));
    fireEvent.click(screen.getByRole('button', { name: 'Summer reading, 6 books' }));
    expect(onOpenShelf).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
    fireEvent.click(screen.getByRole('button', { name: /Recently added/ }));
    expect(onOpenSmart).toHaveBeenCalledWith(expect.objectContaining({ id: 'recent' }));
  });

  it('shows New collection only when the app can create one', () => {
    const onCreate = vi.fn();
    const { rerender } = render(collections());
    expect(screen.queryByRole('button', { name: 'New collection' })).toBeNull();
    rerender(collections({ onCreate }));
    fireEvent.click(screen.getByRole('button', { name: 'New collection' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('puts rename, move and delete in one menu per shelf, without impossible moves', () => {
    const onRename = vi.fn();
    const onDelete = vi.fn();
    const onMove = vi.fn();
    render(collections({ onRename, onDelete, onMove }));
    fireEvent.click(screen.getByRole('button', { name: 'Options for Summer reading' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: 'Move up' })).toBeNull(); // first shelf
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Move down' }));
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }), 1);
    fireEvent.click(screen.getByRole('button', { name: 'Options for For the train' }));
    expect(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Move up' })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Rename' }));
    expect(onRename).toHaveBeenCalledWith(expect.objectContaining({ id: 's3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Options for Summer reading' }));
    const del = within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Delete collection' });
    expect(del.className).toContain('pn-overflow__item--danger');
    fireEvent.click(del);
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
  });

  it('offers no menu when the app gives no row actions, and the last shelf has no Move down', () => {
    const { rerender } = render(collections());
    expect(screen.queryByRole('button', { name: /^Options for/ })).toBeNull();
    rerender(collections({ onMove: noop }));
    fireEvent.click(screen.getAllByRole('button', { name: /^Options for/ }).at(-1)!);
    expect(screen.queryByRole('menuitem', { name: 'Move down' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Move up' })).toBeInTheDocument();
  });

  it('the empty state is a designed illustration with one next step, plus extra actions', () => {
    const onCreate = vi.fn();
    render(collections({ shelves: [], onCreate, emptyActions: <button type="button">Browse ideas</button> }));
    const empty = screen.getByRole('region', { name: 'No collections yet' });
    expect(empty.querySelector('svg')).not.toBeNull();
    fireEvent.click(within(empty).getByRole('button', { name: 'Make a collection' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(within(empty).getByRole('button', { name: 'Browse ideas' })).toBeInTheDocument();
  });

  it('has no Make button in the empty state when the app cannot create', () => {
    render(collections({ shelves: [] }));
    expect(screen.queryByRole('button', { name: 'Make a collection' })).toBeNull();
    expect(screen.getByText('No collections yet')).toBeInTheDocument();
  });

  it('loads with a polite status, not an empty state', () => {
    render(collections({ shelves: [], loading: true }));
    expect(screen.getByRole('status')).toHaveTextContent('Loading your collections');
    expect(screen.queryByText('No collections yet')).toBeNull();
  });

  it('smart shelves can be hidden, and a notice shows above the lists', () => {
    render(collections({ smart: [], notice: <p role="alert">Could not load</p> }));
    expect(screen.queryByText('Automatic')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load');
  });

  it('draws the cover collage and a shelf icon for a shelf without covers', () => {
    render(collections());
    const row = screen.getByRole('button', { name: 'Summer reading, 6 books' });
    expect(row.querySelectorAll('img').length).toBe(4);
    const empty = screen.getByRole('button', { name: /, 0 books$/ });
    expect(empty.querySelector('img')).toBeNull();
    expect(empty.querySelector('svg')).not.toBeNull();
  });
});

describe('CollectionNameSheet and CollectionBooksEmpty', () => {
  const saved: string[] = [];
  function Harness({ error }: { error?: string }) {
    const [name, setName] = useState('');
    return wrap(
      <CollectionNameSheet open mode="create" name={name} onNameChange={setName} onSubmit={() => saved.push(name)} onClose={noop} error={error} />,
    );
  }

  it('is a dialog with the field focused, Save disabled until there is a name, Enter saves', () => {
    render(<Harness />);
    const dialog = screen.getByRole('dialog', { name: 'New collection' });
    const field = within(dialog).getByLabelText('Name');
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.change(field, { target: { value: '  Road trip ' } });
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled();
    fireEvent.submit(field.closest('form')!);
    expect(saved).toEqual(['  Road trip ']); // the app trims; the sheet only blocks blank names
  });

  it('names the problem for screen readers and marks the field invalid', () => {
    render(<Harness error="You already have a collection called that." />);
    expect(screen.getByRole('alert')).toHaveTextContent('already have a collection');
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription(/already have/);
  });

  it('titles the rename mode and limits the name length', () => {
    render(wrap(<CollectionNameSheet open mode="rename" name="x" onNameChange={noop} onSubmit={noop} onClose={noop} busy />));
    expect(screen.getByRole('dialog', { name: 'Rename collection' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveAttribute('maxlength', '60');
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });

  it('an empty collection has an illustration and one next step', () => {
    const onClick = vi.fn();
    render(<CollectionBooksEmpty name="Summer reading" action={{ label: 'Go to your library', onClick }} />);
    const region = screen.getByRole('region', { name: 'Nothing in this collection yet' });
    expect(region).toHaveTextContent('“Summer reading”');
    expect(region.querySelector('svg')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Go to your library' }));
    expect(onClick).toHaveBeenCalled();
  });
});

const LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function stats(over: Partial<StatsScreenProps> = {}) {
  return wrap(
    <StatsScreen minutesPerDay={SAMPLE_WEEK_MINUTES} dayLabels={LABELS} dayNames={NAMES} sessionCount={9} finishedBooks={4} {...over} />,
  );
}

describe('StatsScreen', () => {
  it('shows four plain numbers for the week', () => {
    render(stats());
    expect(screen.getByRole('heading', { level: 1, name: 'Stats' })).toBeInTheDocument();
    const time = screen.getByText('Time').closest('div')!;
    expect(time).toHaveTextContent('3 h 14 min');
    expect(screen.getByText('Days with reading or listening').closest('div')).toHaveTextContent('5 of 7');
    expect(screen.getByText('Most on').closest('div')).toHaveTextContent('Friday, 1 h 11 min');
    expect(screen.getByText('Books finished').closest('div')).toHaveTextContent('4');
  });

  it('names every bar with its day and minutes, and marks today', () => {
    render(stats());
    const chart = screen.getByRole('figure', { name: /Minutes per day, last 7 days/ });
    const days = within(chart).getAllByRole('listitem');
    expect(days).toHaveLength(7);
    expect(days[0]).toHaveTextContent('Sunday: 22 min');
    expect(days[1]).toHaveTextContent('Monday: 0 min');
    expect(days[6]).toHaveTextContent('Today: 18 min');
    expect(days[6]).toHaveAttribute('aria-current', 'date');
    expect(chart.querySelectorAll('[aria-current]')).toHaveLength(1);
  });

  it('scales bars with a CSS variable (transform in CSS), the tallest is full height, empty days are a dash', () => {
    render(stats());
    const bars = [...document.querySelectorAll<HTMLElement>('.pn-stats__bar')];
    const shares = bars.map((b) => Number(b.style.getPropertyValue('--pn-bar')));
    ;[22 / 71, 0, 48 / 71, 35 / 71, 0, 1, 18 / 71].forEach((want, i) => expect(shares[i]).toBeCloseTo(want, 6));
    expect(bars[1]).toHaveClass('pn-stats__bar--none');
    expect(bars.every((b) => b.style.height === '')).toBe(true);
  });

  it('honors todayIndex', () => {
    render(stats({ todayIndex: 2 }));
    expect(screen.getAllByRole('listitem').find((li) => li.getAttribute('aria-current'))).toHaveTextContent('Today: 48 min');
  });

  it('shows the designed empty state when there are no sessions, with an optional next step', () => {
    const onClick = vi.fn();
    render(stats({ sessionCount: 0, minutesPerDay: Array<number>(7).fill(0), emptyAction: { label: 'Open your library', onClick } }));
    const empty = screen.getByRole('region', { name: 'Nothing to count yet' });
    expect(empty.querySelector('svg')).not.toBeNull();
    expect(empty).toHaveTextContent('no streak to keep');
    fireEvent.click(within(empty).getByRole('button', { name: 'Open your library' }));
    expect(onClick).toHaveBeenCalled();
    expect(screen.queryByRole('figure')).toBeNull();
  });

  it('loads with a polite status instead of numbers', () => {
    render(stats({ loading: true }));
    expect(screen.getByRole('status')).toHaveTextContent('Adding up your week');
    expect(screen.queryByRole('figure')).toBeNull();
    expect(screen.queryByText('Nothing to count yet')).toBeNull();
  });

  it('no streaks, goals or red: the copy never pressures', () => {
    render(stats());
    expect(document.body.textContent).not.toMatch(/streak|goal|keep it up|don.t break/i);
  });

  it('a week with sessions but under a minute still shows the chart', () => {
    render(stats({ minutesPerDay: Array<number>(7).fill(0), sessionCount: 1 }));
    expect(screen.getByText('No day yet')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
  });
});

describe('stats helpers', () => {
  it('weekFigures totals, counts active days and finds the best (latest on ties)', () => {
    expect(weekFigures([10, 0, 30, 30, 0, 5, 0])).toEqual({ totalMinutes: 75, activeDays: 4, bestDay: 3, bestMinutes: 30, maxMinutes: 30 });
    expect(weekFigures([0, 0, 0])).toMatchObject({ bestDay: -1, activeDays: 0, maxMinutes: 1 });
    expect(weekFigures([NaN, -4, 6])).toMatchObject({ totalMinutes: 6, activeDays: 1 });
  });
  it('minutesLabel speaks plainly', () => {
    expect(minutesLabel(0)).toBe('0 min');
    expect(minutesLabel(45)).toBe('45 min');
    expect(minutesLabel(65)).toBe('1 h 5 min');
    expect(minutesLabel(120)).toBe('2 h');
    expect(minutesLabel(-3)).toBe('0 min');
  });
  it('barShare keeps small days visible', () => {
    expect(barShare(0, 10)).toBe(0);
    expect(barShare(10, 10)).toBe(1);
    expect(barShare(1, 1000)).toBe(0.04);
    expect(barShare(5, 0)).toBe(0);
  });
});

describe('styles and exports', () => {
  it('bars are at least 3:1 against the card in every theme, and the chart animates only transform', () => {
    for (const theme of THEME_NAMES) {
      const p = THEME_PALETTE[theme];
      expect(contrastRatio(p.accent, p.surface), theme).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(p['border-strong'], p.surface), `${theme} empty dash`).toBeGreaterThanOrEqual(3);
    }
    const css = readUiFile('styles/surfaces.css');
    const rules = parseCss(css);
    const bar = declarationsFor(rules, '.pn-stats__bar');
    expect(bar.transform).toBe('scaleY(var(--pn-bar, 0))');
    expect(bar.height).toBe('100%');
    expect(css).toMatch(/@keyframes pn-bar-grow\s*\{\s*from\s*\{\s*transform: scaleY\(0\);\s*\}\s*\}/);
  });

  it('the screens entry exports the new screens and helpers', () => {
    for (const name of ['CollectionsScreen', 'StatsScreen', 'CollectionNameSheet', 'CollectionBooksEmpty', 'DEFAULT_SMART_COLLECTIONS', 'weekFigures']) {
      expect(screensEntry, name).toHaveProperty(name);
    }
  });

  it('there is a gallery entry for every new state', () => {
    const gallery = readUiFile('demo/ScreenGallery.tsx');
    for (const name of ['collections', 'collections-empty', 'collections-loading', 'collections-new', 'collections-shelf-empty', 'stats', 'stats-empty', 'stats-loading']) {
      expect(gallery).toContain(`'${name}'`);
    }
  });
});
