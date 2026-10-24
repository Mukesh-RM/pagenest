import '../test/setup';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Card, LONG_PRESS_MS } from './Card';
import { ProgressBar } from './ProgressBar';

describe('Card (static)', () => {
  it('renders a container with the card class and the element you ask for', () => {
    render(
      <Card as="article" aria-label="Stats">
        Hello
      </Card>,
    );
    const card = screen.getByRole('article', { name: 'Stats' });
    expect(card).toHaveClass('pn-card');
    expect(card).not.toHaveClass('pn-card--interactive');
  });
});

describe('Card (interactive)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is a button with the 44 px interactive class, and tap calls onPress', () => {
    const onPress = vi.fn();
    render(
      <Card onPress={onPress} aria-label="Night Trains">
        <span>Night Trains</span>
      </Card>,
    );
    const card = screen.getByRole('button', { name: 'Night Trains' });
    expect(card).toHaveClass('pn-card', 'pn-card--interactive');
    fireEvent.pointerDown(card);
    fireEvent.pointerUp(card);
    fireEvent.click(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('long-press (500 ms) calls onLongPress and swallows the click that follows', () => {
    const onPress = vi.fn();
    const onLongPress = vi.fn();
    render(
      <Card onPress={onPress} onLongPress={onLongPress} aria-label="Book">
        x
      </Card>,
    );
    const card = screen.getByRole('button', { name: 'Book' });
    fireEvent.pointerDown(card);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS - 1);
    });
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(card);
    fireEvent.click(card);
    expect(onPress).not.toHaveBeenCalled();
    // The next plain tap works again.
    fireEvent.click(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a short tap never triggers the long press', () => {
    const onLongPress = vi.fn();
    render(
      <Card onPress={() => undefined} onLongPress={onLongPress} aria-label="Book">
        x
      </Card>,
    );
    const card = screen.getByRole('button', { name: 'Book' });
    fireEvent.pointerDown(card);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.pointerUp(card);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('moving the finger away cancels the long press', () => {
    const onLongPress = vi.fn();
    render(
      <Card onPress={() => undefined} onLongPress={onLongPress} aria-label="Book">
        x
      </Card>,
    );
    const card = screen.getByRole('button', { name: 'Book' });
    fireEvent(card, new MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }));
    fireEvent(card, new MouseEvent('pointermove', { bubbles: true, clientX: 10, clientY: 60 }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('right-click or the context-menu key also selects (keyboard route to multi-select)', () => {
    const onLongPress = vi.fn();
    render(
      <Card onPress={() => undefined} onLongPress={onLongPress} aria-label="Book">
        x
      </Card>,
    );
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Book' }));
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('exposes multi-select state with aria-pressed', () => {
    const { rerender } = render(
      <Card onPress={() => undefined} selected={false} aria-label="Book">
        x
      </Card>,
    );
    expect(screen.getByRole('button', { name: 'Book' })).toHaveAttribute('aria-pressed', 'false');
    rerender(
      <Card onPress={() => undefined} selected aria-label="Book">
        x
      </Card>,
    );
    const card = screen.getByRole('button', { name: 'Book' });
    expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(card).toHaveClass('pn-card--selected');
  });
});

describe('ProgressBar', () => {
  it('is a labelled progressbar with a clamped percentage', () => {
    const { rerender } = render(<ProgressBar value={0.42} label="Reading progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Reading progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar.firstElementChild).toHaveStyle('--pn-progress: 0.42');
    rerender(<ProgressBar value={4} label="Reading progress" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    rerender(<ProgressBar value={Number.NaN} label="Reading progress" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });
});
