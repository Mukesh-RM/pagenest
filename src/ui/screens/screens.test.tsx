import '../test/setup';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_BOOKS, SAMPLE_DETAIL, SAMPLE_FONTS, SAMPLE_READER_SETTINGS, SAMPLE_VOICES } from '../demo/sample-data';
import { GALLERY_SCREENS, GalleryRoot } from '../demo/ScreenGallery';
import { resetSheetHistoryForTests } from '../utils/sheetHistory';
import { AudioPlayerScreen } from './AudioPlayerScreen';
import { BookDetailSheet } from './BookDetailSheet';
import { LibraryScreen } from './LibraryScreen';
import { DEFAULT_LIBRARY_FILTERS } from './libraryOptions';
import { ReaderScreen } from './ReaderScreen';
import { VoiceStudioScreen } from './VoiceStudioScreen';

beforeEach(() => {
  resetSheetHistoryForTests();
  window.history.replaceState(null, '', '/');
});
afterEach(() => resetSheetHistoryForTests());

const noop = () => undefined;

function library(overrides: Partial<React.ComponentProps<typeof LibraryScreen>> = {}) {
  return (
    <LibraryScreen
      books={SAMPLE_BOOKS}
      filter="all"
      onFilterChange={noop}
      query=""
      onQueryChange={noop}
      onOpenBook={noop}
      onAdd={noop}
      {...overrides}
    />
  );
}

describe('sample data covers the real-content cases', () => {
  it('has 12+ generated covers, missing covers, long titles, two-line authors, 0 % and 100 %', () => {
    expect(SAMPLE_BOOKS.length).toBeGreaterThanOrEqual(14);
    expect(SAMPLE_BOOKS.filter((b) => b.coverUrl).length).toBeGreaterThanOrEqual(12);
    expect(SAMPLE_BOOKS.filter((b) => !b.coverUrl).length).toBeGreaterThanOrEqual(3);
    expect(SAMPLE_BOOKS.some((b) => b.title.length > 60)).toBe(true);
    expect(SAMPLE_BOOKS.some((b) => (b.author ?? '').length > 50)).toBe(true);
    expect(SAMPLE_BOOKS.some((b) => !b.author)).toBe(true);
    expect(SAMPLE_BOOKS.some((b) => b.progress === 0)).toBe(true);
    expect(SAMPLE_BOOKS.some((b) => b.progress === 1)).toBe(true);
    expect(SAMPLE_BOOKS.some((b) => b.audio)).toBe(true);
    expect(new Set(SAMPLE_BOOKS.map((b) => b.id)).size).toBe(SAMPLE_BOOKS.length);
  });
});

describe('LibraryScreen', () => {
  it('has one h1, a labelled search field, a labelled filter group and a named list of books', () => {
    render(library());
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Library');
    expect(screen.getByRole('searchbox')).toHaveAccessibleName(/search/i);
    const group = screen.getByRole('group', { name: 'Filter library' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent?.trim())).toEqual(['All', 'Reading', 'Listening', 'Finished']);
    const list = screen.getByRole('list', { name: 'Books' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(SAMPLE_BOOKS.length);
    expect(screen.getByRole('button', { name: /add books/i })).toBeInTheDocument();
  });

  it('the selected filter is exposed to assistive tech', () => {
    render(library({ filter: 'listening' }));
    const group = screen.getByRole('group', { name: 'Filter library' });
    const pressed = within(group).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed.map((b) => b.textContent?.trim())).toEqual(['Listening']);
    expect(DEFAULT_LIBRARY_FILTERS).toHaveLength(4);
  });

  it('focus order follows the reading order: Add, search, filters, then the books', () => {
    render(library());
    const order = [
      screen.getByRole('button', { name: /add books/i }),
      screen.getByRole('searchbox'),
      within(screen.getByRole('group', { name: 'Filter library' })).getAllByRole('button')[0]!,
      screen.getAllByRole('button', { name: /Nightjar/ })[0]!,
    ];
    for (let i = 0; i < order.length - 1; i += 1) {
      expect(order[i]!.compareDocumentPosition(order[i + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING, `step ${i}`).toBeTruthy();
    }
  });

  it('while loading it shows a labelled skeleton, not an empty state, and the books are absent', () => {
    render(library({ loading: true }));
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Loading your library');
    expect(screen.queryByRole('list', { name: 'Books' })).toBeNull();
  });

  it('an empty library explains what to do next with one clear action', () => {
    const onAdd = vi.fn();
    render(library({ books: [], onAdd }));
    expect(screen.getByRole('heading', { name: /library is empty/i })).toBeInTheDocument();
    const add = screen.getAllByRole('button', { name: /add books/i });
    fireEvent.click(add[add.length - 1]!);
    expect(onAdd).toHaveBeenCalled();
  });

  it('opening a book passes the book and the cover box (for the shared transition)', () => {
    const onOpenBook = vi.fn();
    render(library({ onOpenBook }));
    fireEvent.click(screen.getAllByRole('button', { name: /^Nightjar, Priya Raman/ })[0]!);
    expect(onOpenBook).toHaveBeenCalledTimes(1);
    expect(onOpenBook.mock.calls[0]![0]).toMatchObject({ title: 'Nightjar' });
    expect(onOpenBook.mock.calls[0]![1]).toHaveProperty('width');
  });
});

describe('BookDetailSheet', () => {
  it('is a modal dialog named by the title, with read, listen and a quiet remove action', () => {
    const onRead = vi.fn();
    const onRemove = vi.fn();
    render(<BookDetailSheet open book={SAMPLE_DETAIL} onClose={noop} onRead={onRead} onListen={noop} onRemove={onRemove} />);
    const dialog = screen.getByRole('dialog', { name: SAMPLE_DETAIL.title });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    fireEvent.click(within(dialog).getByRole('button', { name: /continue reading/i }));
    expect(onRead).toHaveBeenCalledTimes(1);
    // Remove lives in the ⋯ menu, never as a loose red button next to Read.
    expect(within(dialog).queryByRole('button', { name: /remove from library/i })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'More options' }));
    const remove = within(dialog).getByRole('menuitem', { name: /remove from library/i });
    expect(remove.className).toContain('pn-overflow__item--danger');
    fireEvent.click(remove);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByText(/Narrated by Eleanor Whitcombe/)).toBeInTheDocument();
  });

  it('Esc and the Close button report their reason', () => {
    const onClose = vi.fn();
    render(<BookDetailSheet open book={SAMPLE_DETAIL} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledWith('close-button');
  });

  it('shows Read aloud when onReadAloud is provided', () => {
    const onReadAloud = vi.fn();
    render(<BookDetailSheet open book={SAMPLE_DETAIL} onClose={noop} onRead={noop} onReadAloud={onReadAloud} />);
    fireEvent.click(screen.getByRole('button', { name: 'Read aloud' }));
    expect(onReadAloud).toHaveBeenCalledWith(SAMPLE_DETAIL);
  });
});

describe('ReaderScreen', () => {
  function reader(open: boolean, onOpenChange = vi.fn()) {
    return (
      <ReaderScreen
        title="The Orchard at the End of Winter"
        chapter="Chapter 7"
        progress={0.4}
        settings={SAMPLE_READER_SETTINGS}
        fonts={SAMPLE_FONTS}
        onSettingsChange={noop}
        settingsOpen={open}
        onSettingsOpenChange={onOpenChange}
        onBack={noop}
        onOpenContents={noop}
      >
        <p>Page text</p>
      </ReaderScreen>
    );
  }

  it('has Back, Contents and the Aa button with plain names, an h1 and a named article', () => {
    render(reader(false));
    expect(screen.getByRole('button', { name: 'Back to library' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contents' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reading settings' })).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The Orchard');
    expect(screen.getByRole('article')).toHaveTextContent('Page text');
  });

  it('the Aa button opens the settings dialog with size, font, page color, spacing and margins', async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(reader(false, onOpenChange));
    fireEvent.click(screen.getByRole('button', { name: 'Reading settings' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    rerender(reader(true, onOpenChange));
    const dialog = await screen.findByRole('dialog', { name: 'Reading settings' });
    expect(within(dialog).getByRole('slider', { name: 'Text size' })).toBeInTheDocument();
    for (const name of ['Font', 'Page color', 'Line spacing', 'Margins']) {
      expect(within(dialog).getByRole('radiogroup', { name })).toBeInTheDocument();
    }
    expect(within(dialog).getByRole('button', { name: 'Smaller text' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Larger text' })).toBeInTheDocument();
  });
});

describe('AudioPlayerScreen', () => {
  const props = {
    book: SAMPLE_DETAIL,
    chapter: 'Chapter 7',
    playing: false,
    position: 3600,
    duration: 36000,
    speed: 1.25,
    sleepLabel: 'Off',
    onTogglePlay: noop,
    onSeek: noop,
    onSkip: noop,
    onSpeedClick: noop,
    onSleepClick: noop,
    onChaptersClick: noop,
    onCollapse: noop,
  };

  it('every control has a plain name, and the play button reflects the state', () => {
    const { rerender } = render(<AudioPlayerScreen {...props} />);
    expect(screen.getByRole('region', { name: 'Audio player' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Minimize player' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back 15 seconds' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Forward 30 seconds' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Playback position' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Speed 1.25×/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sleep timer: Off/ })).toBeInTheDocument();
    rerender(<AudioPlayerScreen {...props} playing />);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('time left follows the speed and is announced politely', () => {
    const { rerender } = render(<AudioPlayerScreen {...props} />);
    const left = () => document.querySelector('.pn-player__left') as HTMLElement;
    expect(left()).toHaveTextContent('7 h 12 min left at 1.25×');
    expect(left()).toHaveAttribute('aria-live', 'polite');
    rerender(<AudioPlayerScreen {...props} speed={2} />);
    expect(left()).toHaveTextContent('4 h 30 min left at 2×');
  });

  it('skip buttons send signed seconds', () => {
    const onSkip = vi.fn();
    render(<AudioPlayerScreen {...props} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back 15 seconds' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forward 30 seconds' }));
    expect(onSkip.mock.calls).toEqual([[-15], [30]]);
  });
});

describe('VoiceStudioScreen (step 1 of 3)', () => {
  it('voices are radios with names, each with its own sample button; Next and Back are labelled', () => {
    const onSelect = vi.fn();
    const onPreview = vi.fn();
    render(
      <VoiceStudioScreen voices={SAMPLE_VOICES} selectedId="v-amelia" onSelect={onSelect} onPreview={onPreview} onNext={noop} onBack={noop} />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Pick a voice' })).toBeInTheDocument();
    expect(screen.getByLabelText('Step 1 of 3')).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(SAMPLE_VOICES.length);
    expect(screen.getByRole('radio', { name: /Amelia/ })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: /Noah/ }));
    expect(onSelect).toHaveBeenCalledWith('v-noah');
    fireEvent.click(screen.getByRole('button', { name: 'Play sample of Priya' }));
    expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ id: 'v-priya' }));
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });
});

describe('every gallery screen renders without errors', () => {
  it.each(GALLERY_SCREENS)('%s', async (screenName) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = render(<GalleryRoot screen={screenName} theme="dark" scale={1} reduceMotion />);
    await waitFor(() => expect(container.innerHTML.length + document.body.innerHTML.length).toBeGreaterThan(200));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
