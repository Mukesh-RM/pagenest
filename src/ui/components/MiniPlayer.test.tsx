import '../test/setup';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MiniPlayer } from './MiniPlayer';

const base = {
  title: 'Night Trains',
  subtitle: 'Chapter 7',
  playing: false,
  onTogglePlay: () => undefined,
  onSkipBack: () => undefined,
  onExpand: () => undefined,
};

describe('MiniPlayer', () => {
  it('is a labelled region showing title and subtitle', () => {
    render(<MiniPlayer {...base} />);
    const region = screen.getByRole('region', { name: 'Mini player' });
    expect(region).toHaveTextContent('Night Trains');
    expect(region).toHaveTextContent('Chapter 7');
  });

  it('is visual only: it never creates an audio or video element', () => {
    const { container } = render(<MiniPlayer {...base} coverUrl="/cover.jpg" />);
    expect(container.querySelector('audio, video')).toBeNull();
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('shows Play when paused and Pause when playing, driven only by props', async () => {
    const user = userEvent.setup();
    const onTogglePlay = vi.fn();
    const { rerender } = render(<MiniPlayer {...base} onTogglePlay={onTogglePlay} />);
    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    rerender(<MiniPlayer {...base} playing onTogglePlay={onTogglePlay} />);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
  });

  it('has a "Back 15 seconds" button (configurable) and 44 px icon buttons', async () => {
    const user = userEvent.setup();
    const onSkipBack = vi.fn();
    const { rerender } = render(<MiniPlayer {...base} onSkipBack={onSkipBack} />);
    const back = screen.getByRole('button', { name: 'Back 15 seconds' });
    expect(back).toHaveClass('pn-miniplayer__skip');
    await user.click(back);
    expect(onSkipBack).toHaveBeenCalledTimes(1);
    rerender(<MiniPlayer {...base} skipBackSeconds={30} />);
    expect(screen.getByRole('button', { name: 'Back 30 seconds' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toHaveClass('pn-miniplayer__play');
  });

  it('tap on the cover/title area expands, and it is keyboard operable', async () => {
    const user = userEvent.setup();
    const onExpand = vi.fn();
    render(<MiniPlayer {...base} onExpand={onExpand} />);
    const expand = screen.getByRole('button', { name: 'Open player: Night Trains' });
    await user.click(expand);
    expand.focus();
    await user.keyboard('{Enter}');
    expect(onExpand).toHaveBeenCalledTimes(2);
  });

  it('a swipe up expands; a small movement or a swipe down does not', () => {
    const onExpand = vi.fn();
    render(<MiniPlayer {...base} onExpand={onExpand} />);
    const region = screen.getByRole('region', { name: 'Mini player' });
    const fire = (type: string, clientY: number) =>
      act(() => {
        region.dispatchEvent(new MouseEvent(type, { bubbles: true, clientY }));
      });
    fire('pointerdown', 200);
    fire('pointerup', 190);
    expect(onExpand).not.toHaveBeenCalled();
    fire('pointerdown', 200);
    fire('pointerup', 260);
    expect(onExpand).not.toHaveBeenCalled();
    fire('pointerdown', 200);
    fire('pointerup', 150);
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('shows playback position as a progressbar', () => {
    render(<MiniPlayer {...base} progress={0.35} />);
    expect(screen.getByRole('progressbar', { name: 'Playback position' })).toHaveAttribute('aria-valuenow', '35');
  });
});
