import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DriveModeView from './DriveModeView';
import { useEnginePlayerStore } from '@/features/player/engine-store';

describe('DriveModeView', () => {
  it('renders large controls with book title and exit', () => {
    useEnginePlayerStore.getState().setState({
      status: 'paused',
      positionSec: 30,
      durationSec: 3600,
      chapterIndex: 0,
      chapterRemainingSec: 300,
      bookRemainingSec: 3570,
      speed: 1,
      options: { skipBackSec: 15, skipForwardSec: 30, smartRewindSec: 0 },
      item: {
        bookId: 'b1',
        title: 'Night Road',
        tracks: [],
        chapters: [{ index: 0, title: 'Chapter 1', startSec: 0 }],
      },
    });
    render(
      <DriveModeView
        controller={
          {
            toggle: async () => {},
            skip: () => {},
            previousChapter: () => {},
            nextChapter: () => {},
            setSpeed: () => {},
          } as never
        }
        onExit={() => {}}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Drive mode' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Night Road' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back 30 seconds' })).toBeInTheDocument();
  });
});
