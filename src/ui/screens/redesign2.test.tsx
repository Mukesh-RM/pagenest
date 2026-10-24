import '../test/setup';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_BOOKS, SAMPLE_DETAIL, SAMPLE_FONTS, SAMPLE_READER_SETTINGS } from '../demo/sample-data';
import { ErrorNotice, canRetry, PLAIN_ERRORS, type PlainErrorKind } from '../components/ErrorNotice';
import { OverflowMenu } from '../components/OverflowMenu';
import { ThemeProvider } from '../theme';
import { rememberFlipOrigin, takeFlipOrigin } from '../utils/flip';
import { chapterLeftLabel } from '../utils/time';
import userEvent from '@testing-library/user-event';
import { resetSheetHistoryForTests } from '../utils/sheetHistory';
import { AudioPlayerScreen, type AudioPlayerController } from './AudioPlayerScreen';
import { LibraryScreen } from './LibraryScreen';
import { ReaderScreen } from './ReaderScreen';
import { SettingsScreen } from './SettingsScreen';
import * as screensEntry from './index';
import * as barrel from '../index';

beforeEach(() => {
  resetSheetHistoryForTests();
  window.history.replaceState(null, '', '/');
});

const noop = () => undefined;

function controller(over: Partial<AudioPlayerController> = {}): AudioPlayerController {
  return {
    playing: true,
    position: 600,
    duration: 3600,
    speed: 1.5,
    sleepLabel: '15 min',
    toggle: vi.fn(),
    seek: vi.fn(),
    skip: vi.fn(),
    cycleSpeed: vi.fn(),
    openSleep: vi.fn(),
    openChapters: vi.fn(),
    ...over,
  };
}

describe('AudioPlayerScreen controller prop', () => {
  it('drives every control and wins over the individual props', () => {
    const c = controller();
    const stale = vi.fn();
    render(
      <AudioPlayerScreen
        book={SAMPLE_DETAIL}
        chapter="Chapter 2"
        controller={c}
        playing={false}
        speed={1}
        sleepLabel="Off"
        onTogglePlay={stale}
        onSkip={stale}
        onSpeedClick={stale}
        onSleepClick={stale}
        onChaptersClick={stale}
        onCollapse={noop}
      />,
    );
    // The controller says playing, 1.5x, 15 min; the stale individual props say otherwise.
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(c.toggle).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Back 15 seconds' }));
    expect(c.skip).toHaveBeenCalledWith(-15);
    fireEvent.click(screen.getByRole('button', { name: 'Forward 30 seconds' }));
    expect(c.skip).toHaveBeenCalledWith(30);
    fireEvent.click(screen.getByRole('button', { name: /Speed 1.5×/ }));
    expect(c.cycleSpeed).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Sleep timer: 15 min/ }));
    expect(c.openSleep).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();
  });

  it('has no seek callback until the controller gives one, and seeks through it', () => {
    const c = controller();
    render(<AudioPlayerScreen book={SAMPLE_DETAIL} chapter="Chapter 2" controller={c} onCollapse={noop} />);
    const slider = screen.getByRole('slider', { name: 'Playback position' });
    fireEvent.change(slider, { target: { value: '900' } });
    expect(c.seek).toHaveBeenCalledWith(900);
  });
});

describe('FLIP hand-off', () => {
  it('returns the remembered origin once, then nothing', () => {
    const rect = { left: 4, top: 8, width: 40, height: 60 };
    rememberFlipOrigin(rect);
    expect(takeFlipOrigin()).toEqual(rect);
    expect(takeFlipOrigin()).toBeUndefined();
  });

  it('drops an origin that is too old', () => {
    rememberFlipOrigin({ left: 0, top: 0, width: 1, height: 1 });
    expect(takeFlipOrigin(-1)).toBeUndefined();
  });
});

describe('LibraryScreen add affordances', () => {
  const base = { filter: 'all' as const, onFilterChange: noop, query: '', onQueryChange: noop, onOpenBook: noop };

  it('hides the Add button when onAdd is absent', () => {
    render(<LibraryScreen {...base} books={SAMPLE_BOOKS} />);
    expect(screen.queryByRole('button', { name: /add books/i })).toBeNull();
  });

  it('shows the Add button when onAdd is given', () => {
    render(<LibraryScreen {...base} books={SAMPLE_BOOKS} onAdd={noop} />);
    expect(screen.getAllByRole('button', { name: /add books/i }).length).toBeGreaterThan(0);
  });

  it('renders emptyActions in the empty library, with or without onAdd', () => {
    const { rerender } = render(<LibraryScreen {...base} books={[]} emptyActions={<button type="button">Open the starter book</button>} />);
    expect(screen.getByRole('button', { name: 'Open the starter book' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add books/i })).toBeNull();
    rerender(<LibraryScreen {...base} books={[]} onAdd={noop} emptyActions={<button type="button">Open the starter book</button>} />);
    expect(screen.getByRole('button', { name: 'Open the starter book' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /add books/i }).length).toBeGreaterThan(0);
  });
});

function SettingsHarness({ withInstall = true }: { withInstall?: boolean }) {
  const [theme, setTheme] = useState<'light' | 'dark' | 'black' | 'sepia' | 'system' | 'custom'>('light');
  const [size, setSize] = useState(16);
  return (
    <ThemeProvider mode="light">
      <SettingsScreen
        theme={theme}
        onThemeChange={setTheme}
        onCustomThemeChange={noop}
        textSize={size}
        onTextSizeChange={setSize}
        install={withInstall ? <button type="button">Install help</button> : undefined}
        storage={{ usageText: 'PageNest uses 12 MB of about 40 GB available.', persisted: false, onKeepData: vi.fn() }}
      />
    </ThemeProvider>
  );
}

describe('SettingsScreen', () => {
  it('has grouped, labelled sections', () => {
    render(<SettingsHarness />);
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    for (const name of ['Appearance', 'Reading', 'Install help', 'Storage used', 'About']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
  });

  it('every section is its own card, text size and its live sample sit together in Reading', () => {
    const { container } = render(<SettingsHarness />);
    const cards = container.querySelectorAll('section.pn-set-card');
    expect(cards.length).toBeGreaterThanOrEqual(5);
    for (const card of cards) expect(card.querySelector('h2.pn-set-card__title')).not.toBeNull();
    const reading = screen.getByRole('region', { name: 'Reading' });
    expect(within(reading).getByRole('slider', { name: 'Text size' })).toBeInTheDocument();
    expect(within(reading).getByTestId('text-sample')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Appearance' })).queryByRole('slider')).toBeNull();
  });

  it('hides Install help when no install control is given and Storage when null', () => {
    const { rerender } = render(<SettingsHarness withInstall={false} />);
    expect(screen.queryByRole('region', { name: 'Install help' })).toBeNull();
    rerender(
      <ThemeProvider mode="light">
        <SettingsScreen theme="light" onThemeChange={noop} onCustomThemeChange={noop} textSize={16} onTextSizeChange={noop} storage={null} />
      </ThemeProvider>,
    );
    expect(screen.queryByRole('region', { name: 'Storage used' })).toBeNull();
  });

  it('shows the selected theme clearly and reaches 200% text', async () => {
    const user = userEvent.setup();
    render(<SettingsHarness />);
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '32' } });
    expect(slider).toHaveValue('32');
  });

  it('offers Keep my data only when the browser may clear data', () => {
    render(<SettingsHarness />);
    expect(screen.getByRole('button', { name: 'Keep my data' })).toBeInTheDocument();
  });
});

describe('SettingsScreen contrast row', () => {
  it('shows a Contrast group only when the app passes the setting, and reports the choice', () => {
    const onContrast = vi.fn();
    const { rerender } = render(
      <ThemeProvider mode="light">
        <SettingsScreen theme="light" onThemeChange={noop} onCustomThemeChange={noop} textSize={16} onTextSizeChange={noop} storage={null} />
      </ThemeProvider>,
    );
    expect(screen.queryByRole('radiogroup', { name: 'Contrast' })).toBeNull();
    rerender(
      <ThemeProvider mode="light">
        <SettingsScreen
          theme="light"
          onThemeChange={noop}
          onCustomThemeChange={noop}
          textSize={16}
          onTextSizeChange={noop}
          storage={null}
          contrastMode="system"
          onContrastModeChange={onContrast}
        />
      </ThemeProvider>,
    );
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Contrast' })).getByRole('radio', { name: 'High contrast' }));
    expect(onContrast).toHaveBeenCalledWith('high');
  });
});

describe('OverflowMenu', () => {
  it('opens on click, focuses the first row, runs the choice and closes', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<OverflowMenu items={[{ label: 'Remove from library', danger: true, onSelect }]} />);
    const button = screen.getByRole('button', { name: 'More options' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const row = screen.getByRole('menuitem', { name: 'Remove from library' });
    expect(row).toHaveFocus();
    await user.click(row);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes with Escape and returns focus to the button', async () => {
    const user = userEvent.setup();
    render(<OverflowMenu items={[{ label: 'One', onSelect: noop }, { label: 'Two', onSelect: noop }]} />);
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'More options' })).toHaveFocus();
  });

  it('closes on an outside tap', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">outside</button>
        <OverflowMenu items={[{ label: 'One', onSelect: noop }]} />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('ErrorNotice retry rules', () => {
  const kinds = Object.keys(PLAIN_ERRORS) as PlainErrorKind[];

  it('never offers "Try again" for DRM, damaged or unsupported files, and says what to do instead', () => {
    for (const kind of ['drm', 'damaged', 'unsupported'] as const) {
      expect(canRetry(kind)).toBe(false);
      const { unmount } = render(<ErrorNotice kind={kind} actionLabel="Try again" onAction={noop} />);
      expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
      expect(within(screen.getByRole('alert')).getByText(/\w+/, { selector: '.pn-error__help' })).toBeInTheDocument();
      unmount();
    }
  });

  it('keeps a different next step, such as "Choose another file", and keeps retry for the rest', () => {
    const onAction = vi.fn();
    const { unmount } = render(<ErrorNotice kind="drm" actionLabel="Choose another file" onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose another file' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    unmount();
    for (const kind of kinds.filter(canRetry)) {
      const view = render(<ErrorNotice kind={kind} actionLabel="Try again" onAction={noop} />);
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
      view.unmount();
    }
  });
});

describe('Reader time left in the chapter', () => {
  it('words the label plainly', () => {
    expect(chapterLeftLabel(8)).toBe('8 min left in chapter');
    expect(chapterLeftLabel(0.2)).toBe('Less than a minute left in chapter');
    expect(chapterLeftLabel(75)).toBe('1 h 15 min left in chapter');
    expect(chapterLeftLabel(-1)).toBe('');
  });

  it('shows it in the footer beside the book progress', () => {
    render(
      <ReaderScreen
        title="Night Trains"
        chapter="Chapter 7"
        progress={0.42}
        settings={SAMPLE_READER_SETTINGS}
        fonts={SAMPLE_FONTS}
        onSettingsChange={noop}
        settingsOpen={false}
        onSettingsOpenChange={noop}
        minutesLeftInChapter={8}
        onBack={noop}
      >
        <p>Text.</p>
      </ReaderScreen>,
    );
    expect(screen.getByText('8 min left in chapter')).toBeInTheDocument();
    expect(screen.getByText('42% through the book')).toBeInTheDocument();
  });
});

describe('entries', () => {
  it('keeps screens out of the lean barrel at runtime and exposes them from the screens entry', () => {
    for (const name of ['LibraryScreen', 'OnboardingScreen', 'SettingsScreen', 'AudioPlayerScreen', 'ReaderScreen', 'BookDetailSheet', 'VoiceStudioScreen']) {
      expect(barrel).not.toHaveProperty(name);
      expect(screensEntry).toHaveProperty(name);
    }
  });

  it('gives every screen module a default export for React.lazy', async () => {
    for (const mod of [
      await import('./OnboardingScreen'),
      await import('./SettingsScreen'),
      await import('./LibraryScreen'),
      await import('./AudioPlayerScreen'),
      await import('./ReaderScreen'),
      await import('./BookDetailSheet'),
      await import('./VoiceStudioScreen'),
    ]) {
      expect(typeof mod.default).toBe('function');
    }
  });
});
