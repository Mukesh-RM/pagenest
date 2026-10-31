import '../test/setup';
import type React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SAMPLE_FONTS, SAMPLE_READER_SETTINGS } from '../demo/sample-data';
import { ReaderScrubber } from '../components/ReaderScrubber';
import { ReaderScreen } from './ReaderScreen';
import type { ReaderTocItem } from '../types';

const noop = () => undefined;

const TOC: readonly ReaderTocItem[] = [
  { id: 'c1', title: 'Chapter 1: The road' },
  { id: 'c7', title: 'Chapter 7: The orchard', children: [{ id: 'c7a', title: 'March winds' }] },
];

describe('ReaderScrubber', () => {
  it('announces the spoken value and commits on change', async () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    render(<ReaderScrubber value={0.4} valueText="Page 8 of 20" ticks={[0, 0.5]} onCommit={onCommit} />);
    const input = screen.getByRole('slider', { name: 'Position in the book' });
    expect(input).toHaveAttribute('aria-valuetext', 'Page 8 of 20');
    fireEvent.change(input, { target: { value: '500' } });
    await vi.advanceTimersByTimeAsync(200);
    expect(onCommit).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('ReaderScreen polish', () => {
  const rect = { left: 0, top: 0, width: 300, height: 400, right: 300, bottom: 400, x: 0, y: 0, toJSON: () => ({}) };

  function base(over: Partial<React.ComponentProps<typeof ReaderScreen>> = {}) {
    return (
      <ReaderScreen
        title="Night Trains"
        chapter="Chapter 7"
        progress={0.42}
        settings={SAMPLE_READER_SETTINGS}
        fonts={SAMPLE_FONTS}
        onSettingsChange={noop}
        settingsOpen={false}
        onSettingsOpenChange={noop}
        onBack={noop}
        {...over}
      >
        <p>Page text</p>
      </ReaderScreen>
    );
  }

  it('uses a scrubber when onScrubCommit is given', () => {
    render(
      base({
        progressLabel: 'Page 8 of 20',
        onScrubCommit: noop,
        chapterTicks: [0, 0.5],
      }),
    );
    expect(screen.getByRole('slider', { name: 'Position in the book' })).toBeInTheDocument();
    expect(screen.getByText('Page 8 of 20')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('tap center toggles immersive chrome', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);
    render(base({ immersiveChrome: true }));
    const page = screen.getByRole('article');
    expect(screen.getByRole('button', { name: 'Back to library' })).toBeVisible();
    fireEvent.pointerUp(page, { clientX: 150, clientY: 200, pointerId: 1, pointerType: 'mouse', button: 0 });
    const frame = page.closest('.pn-reader__frame');
    expect(frame).toHaveAttribute('data-chrome-hidden', 'true');
  });

  it('shows loading and error overlays', () => {
    const { rerender } = render(base({ loading: { message: 'Opening the book…' }, paginated: true }));
    expect(screen.getByText('Opening the book…')).toBeInTheDocument();
    rerender(
      base({
        error: { title: 'Damaged file', message: 'Try another copy.', onRetry: noop },
        paginated: true,
      }),
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('opens the built-in contents sheet', () => {
    const onTocOpenChange = vi.fn();
    render(
      base({
        toc: TOC,
        tocOpen: true,
        onTocOpenChange,
        tocCurrentId: 'c7',
        onTocSelect: noop,
      }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Contents' });
    expect(within(dialog).getByRole('button', { name: 'Chapter 7: The orchard' })).toHaveAttribute('aria-current', 'location');
  });
});
