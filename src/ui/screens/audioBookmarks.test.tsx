import '../test/setup';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_DETAIL } from '../demo/sample-data';
import { DEFAULT_SHORTCUTS, ShortcutsProvider } from '../shortcuts';
import type { PlayerBookmark } from '../types';
import { AudioPlayerScreen, type AudioPlayerController, type AudioPlayerScreenProps } from './AudioPlayerScreen';
import { SKIP_INTERVALS, playerShortcutDescriptions } from './playerOptions';

const noop = () => undefined;
const base: AudioPlayerScreenProps = {
  book: SAMPLE_DETAIL,
  chapter: 'Chapter 7',
  position: 3600 + 2 * 60 + 3,
  duration: 36000,
  onTogglePlay: noop,
  onSeek: noop,
  onSkip: noop,
  onCollapse: noop,
};
const marks: PlayerBookmark[] = [
  { id: 'b2', positionSec: 7200, chapter: 'Chapter 4' },
  { id: 'b1', positionSec: 754, label: 'The gate' },
];

afterEach(() => {
  vi.useRealTimers();
});

describe('bookmarks: the chip', () => {
  it('is hidden without onAddBookmark, and then so is the menu', () => {
    render(<AudioPlayerScreen {...base} />);
    expect(screen.queryByRole('button', { name: /Add bookmark/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More options' })).toBeNull();
  });

  it('is a visible chip in the chip row, adds at the current position and says so politely', () => {
    const onAddBookmark = vi.fn();
    render(<AudioPlayerScreen {...base} onAddBookmark={onAddBookmark} />);
    const chip = screen.getByRole('button', { name: 'Add bookmark at 1:02:03' });
    expect(chip).toHaveTextContent('Bookmark');
    expect(chip.closest('.pn-player__chips')).not.toBeNull();
    fireEvent.click(chip);
    expect(onAddBookmark).toHaveBeenCalledWith(3723);
    expect(screen.getByRole('status')).toHaveTextContent('Bookmark added at 1:02:03');
  });
});

describe('bookmarks: the list', () => {
  const open = async (props: Partial<AudioPlayerScreenProps> = {}) => {
    const user = userEvent.setup();
    render(<AudioPlayerScreen {...base} bookmarks={marks} {...props} />);
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Bookmarks (2)' }));
    return { user, dialog: await screen.findByRole('dialog', { name: 'Bookmarks' }) };
  };

  it('the ⋯ menu entry opens a sheet listing time and label in book order', async () => {
    const { dialog } = await open();
    const rows = within(dialog).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('12:34');
    expect(rows[0]).toHaveTextContent('The gate');
    expect(rows[1]).toHaveTextContent('2:00:00');
    expect(rows[1]).toHaveTextContent('Bookmark');
    expect(rows[1]).toHaveTextContent('Chapter 4');
  });

  it('tapping a row seeks to it and closes the sheet', async () => {
    const onSeek = vi.fn();
    const { user, dialog } = await open({ onSeek });
    await user.click(within(dialog).getByRole('button', { name: 'Go to 12:34, The gate' }));
    expect(onSeek).toHaveBeenCalledWith(754);
    expect(screen.queryByRole('dialog', { name: 'Bookmarks' })).toBeNull();
  });

  it('delete calls back with the bookmark and has a named button per row', async () => {
    const onDeleteBookmark = vi.fn();
    const { user, dialog } = await open({ onDeleteBookmark });
    await user.click(within(dialog).getByRole('button', { name: 'Delete bookmark at 2:00:00' }));
    expect(onDeleteBookmark).toHaveBeenCalledWith(marks[0]);
    expect(within(dialog).getByRole('button', { name: 'Delete bookmark at 12:34, The gate' })).toBeInTheDocument();
  });

  it('without onDeleteBookmark there is no delete button', async () => {
    const { dialog } = await open();
    expect(within(dialog).queryByRole('button', { name: /Delete bookmark/ })).toBeNull();
  });

  it('shows a plain empty state, and Add bookmark here when adding is possible', async () => {
    const onAddBookmark = vi.fn();
    const user = userEvent.setup();
    render(<AudioPlayerScreen {...base} bookmarks={[]} onAddBookmark={onAddBookmark} />);
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Bookmarks (0)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bookmarks' });
    expect(dialog).toHaveTextContent('No bookmarks yet');
    await user.click(within(dialog).getByRole('button', { name: 'Add bookmark here' }));
    expect(onAddBookmark).toHaveBeenCalledWith(3723);
  });

  it('Esc closes the menu first, then the sheet; focus returns to the ⋯ button', async () => {
    const user = userEvent.setup();
    render(<AudioPlayerScreen {...base} bookmarks={marks} />);
    const button = screen.getByRole('button', { name: 'More options' });
    button.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Bookmarks (2)' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: 'Bookmarks' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Bookmarks' })).toBeNull();
  });

  it('onOpenBookmarks lets the app show its own list (no built-in sheet)', async () => {
    const onOpenBookmarks = vi.fn();
    const user = userEvent.setup();
    render(<AudioPlayerScreen {...base} onOpenBookmarks={onOpenBookmarks} />);
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Bookmarks' }));
    expect(onOpenBookmarks).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the controller carries bookmarks and the skip lengths, and wins over props', async () => {
    const controller: AudioPlayerController = {
      playing: false, position: 100, duration: 1000, speed: 1, sleepLabel: 'Off',
      toggle: noop, seek: noop, skip: vi.fn(), cycleSpeed: noop, openSleep: noop, openChapters: noop,
      skipBackSeconds: 60, skipForwardSeconds: 10, setSkipInterval: vi.fn(),
      bookmarks: marks, addBookmark: vi.fn(),
    };
    render(<AudioPlayerScreen {...base} controller={controller} skipBackSeconds={15} />);
    expect(screen.getByRole('button', { name: 'Back 60 seconds' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Forward 10 seconds' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add bookmark at 1:40' }));
    expect(controller.addBookmark).toHaveBeenCalledWith(100);
    fireEvent.click(screen.getByRole('button', { name: 'Back 60 seconds' }));
    expect(controller.skip).toHaveBeenCalledWith(-60);
    await userEvent.setup().click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Bookmarks (2)', 'Skip buttons']);
  });
});

describe('skip buttons', () => {
  it('default to 15 back and 30 forward, with the number in the glyph and a plain name', () => {
    render(<AudioPlayerScreen {...base} />);
    const back = screen.getByRole('button', { name: 'Back 15 seconds' });
    expect(back).toHaveTextContent('15');
    expect(screen.getByRole('button', { name: 'Forward 30 seconds' })).toHaveTextContent('30');
  });

  it('follow the props, and send signed seconds', () => {
    const onSkip = vi.fn();
    render(<AudioPlayerScreen {...base} skipBackSeconds={10} skipForwardSeconds={60} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back 10 seconds' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forward 60 seconds' }));
    expect(onSkip.mock.calls).toEqual([[-10], [60]]);
  });

  it('are fixed, with no hint and no menu, when nobody can store a change', () => {
    render(<AudioPlayerScreen {...base} />);
    expect(screen.getByRole('button', { name: 'Back 15 seconds' })).not.toHaveAttribute('title');
    expect(screen.queryByRole('button', { name: 'More options' })).toBeNull();
  });

  it('holding a button opens the chooser and does not skip; a short tap still skips', () => {
    vi.useFakeTimers();
    const onSkip = vi.fn();
    render(<AudioPlayerScreen {...base} onSkip={onSkip} onSkipIntervalChange={noop} />);
    const back = screen.getByRole('button', { name: 'Back 15 seconds' });
    expect(back).toHaveAttribute('title', 'Hold to change');
    fireEvent.pointerDown(back);
    act(() => void vi.advanceTimersByTime(200));
    fireEvent.pointerUp(back);
    fireEvent.click(back);
    expect(onSkip).toHaveBeenCalledWith(-15);
    expect(screen.queryByRole('dialog')).toBeNull();
    onSkip.mockClear();
    fireEvent.pointerDown(back);
    act(() => void vi.advanceTimersByTime(600));
    expect(screen.getByRole('dialog', { name: 'Skip buttons' })).toBeInTheDocument();
    fireEvent.pointerUp(back);
    fireEvent.click(back);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('the context-menu key or a right click opens it too', () => {
    render(<AudioPlayerScreen {...base} onSkipIntervalChange={noop} />);
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Forward 30 seconds' }));
    expect(screen.getByRole('dialog', { name: 'Skip buttons' })).toBeInTheDocument();
  });

  it('the ⋯ menu has Skip buttons for people who do not hold; the chooser is two radio groups of 10, 15, 30, 60', async () => {
    const onSkipIntervalChange = vi.fn();
    const user = userEvent.setup();
    render(<AudioPlayerScreen {...base} onSkipIntervalChange={onSkipIntervalChange} />);
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Skip buttons' }));
    const dialog = await screen.findByRole('dialog', { name: 'Skip buttons' });
    const back = within(dialog).getByRole('radiogroup', { name: 'Back, seconds' });
    const forward = within(dialog).getByRole('radiogroup', { name: 'Forward, seconds' });
    expect(within(back).getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual(SKIP_INTERVALS.map((n) => `${n} seconds`));
    expect(within(back).getByRole('radio', { name: '15 seconds' })).toBeChecked();
    expect(within(forward).getByRole('radio', { name: '30 seconds' })).toBeChecked();
    await user.click(within(back).getByRole('radio', { name: '30 seconds' }));
    expect(onSkipIntervalChange).toHaveBeenCalledWith('back', 30);
    await user.click(within(forward).getByRole('radio', { name: '60 seconds' }));
    expect(onSkipIntervalChange).toHaveBeenCalledWith('forward', 60);
  });

  it('skipIntervals can offer 45, and a current value outside the list is still shown', async () => {
    const user = userEvent.setup();
    render(<AudioPlayerScreen {...base} skipBackSeconds={20} skipIntervals={[15, 30, 45]} onSkipIntervalChange={noop} />);
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Skip buttons' }));
    const back = within(await screen.findByRole('dialog')).getByRole('radiogroup', { name: 'Back, seconds' });
    expect(within(back).getAllByRole('radio').map((r) => r.textContent)).toEqual(['15', '20', '30', '45']);
    expect(within(back).getByRole('radio', { name: '20 seconds' })).toBeChecked();
  });

  it('the chooser works by keyboard: arrows move and choose', async () => {
    const onSkipIntervalChange = vi.fn();
    const user = userEvent.setup();
    render(<AudioPlayerScreen {...base} onSkipIntervalChange={onSkipIntervalChange} />);
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Back 15 seconds' }));
    const dialog = screen.getByRole('dialog');
    within(dialog).getByRole('radio', { name: '15 seconds', checked: true, hidden: false });
    (within(within(dialog).getByRole('radiogroup', { name: 'Back, seconds' })).getByRole('radio', { name: '15 seconds' })).focus();
    await user.keyboard('{ArrowRight}');
    expect(onSkipIntervalChange).toHaveBeenCalledWith('back', 30);
  });
});

describe('keyboard shortcuts in the player', () => {
  it('ArrowLeft and ArrowRight skip by the chosen lengths, Space plays, B bookmarks', () => {
    const onSkip = vi.fn();
    const onTogglePlay = vi.fn();
    const onAddBookmark = vi.fn();
    render(<AudioPlayerScreen {...base} skipBackSeconds={10} skipForwardSeconds={45} onSkip={onSkip} onTogglePlay={onTogglePlay} onAddBookmark={onAddBookmark} />);
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    fireEvent.keyDown(document.body, { key: ' ' });
    fireEvent.keyDown(document.body, { key: 'b' });
    expect(onSkip.mock.calls).toEqual([[-10], [45]]);
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
    expect(onAddBookmark).toHaveBeenCalledWith(3723);
  });

  it('does nothing for a key whose handler the app did not give, and can be turned off', () => {
    const onSkip = vi.fn();
    const { rerender } = render(<AudioPlayerScreen {...base} onSkip={undefined} onTogglePlay={undefined} />);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(onSkip).not.toHaveBeenCalled();
    rerender(<AudioPlayerScreen {...base} onSkip={onSkip} shortcuts={false} />);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('are off while a sheet is open, and an arrow on a focused button is left to the button', async () => {
    const onSkip = vi.fn();
    render(<AudioPlayerScreen {...base} onSkip={onSkip} onSkipIntervalChange={noop} />);
    screen.getByRole('button', { name: 'Play' }).focus();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Play' }), { key: 'ArrowRight' });
    expect(onSkip).not.toHaveBeenCalled();
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Back 15 seconds' }));
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('uses the remapped keys of the app provider', () => {
    const onAddBookmark = vi.fn();
    render(
      <ShortcutsProvider bindings={{ bookmark: ['m'] }}>
        <AudioPlayerScreen {...base} onAddBookmark={onAddBookmark} />
      </ShortcutsProvider>,
    );
    fireEvent.keyDown(document.body, { key: 'b' });
    expect(onAddBookmark).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'm' });
    expect(onAddBookmark).toHaveBeenCalledTimes(1);
  });

  it('B is a default shortcut, listed in the ? dialog, and the descriptions follow the skip lengths', () => {
    expect(DEFAULT_SHORTCUTS.bookmark).toEqual(['b']);
    expect(playerShortcutDescriptions(15, 30)).toEqual({ seekBack: 'Back 15 seconds', seekForward: 'Forward 30 seconds', bookmark: 'Add a bookmark here' });
    render(
      <ShortcutsProvider descriptions={playerShortcutDescriptions(10, 60)}>
        <p>app</p>
      </ShortcutsProvider>,
    );
    fireEvent.keyDown(document.body, { key: '?' });
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(dialog).toHaveTextContent('Back 10 seconds');
    expect(dialog).toHaveTextContent('Forward 60 seconds');
    expect(dialog).toHaveTextContent('Add a bookmark here');
  });
});
