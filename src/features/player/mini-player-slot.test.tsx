import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { miniPlayerSlot, useMiniPlayerActive } from './mini-player-slot';
import { selectMiniPlayerActive, usePlayerStore } from './audio-store';

describe('miniPlayerSlot', () => {
  it('exposes Component and useActive', () => {
    expect(miniPlayerSlot.Component).toBeTypeOf('function');
    expect(miniPlayerSlot.useActive).toBe(useMiniPlayerActive);
  });

  it('useMiniPlayerActive tracks loaded book state', () => {
    usePlayerStore.getState().setState({
      status: 'idle',
      positionSec: 0,
      durationSec: 0,
      chapterIndex: -1,
      chapterRemainingSec: 0,
      bookRemainingSec: 0,
      speed: 1,
      options: { skipBackSec: 15, skipForwardSec: 30, smartRewindSec: 5 },
    });
    expect(renderHook(() => useMiniPlayerActive()).result.current).toBe(false);
    expect(selectMiniPlayerActive()).toBe(false);

    usePlayerStore.getState().setState({
      status: 'paused',
      item: {
        bookId: 'b1',
        title: 'Test',
        tracks: [],
        chapters: [],
      },
      positionSec: 0,
      durationSec: 10,
      chapterIndex: 0,
      chapterRemainingSec: 10,
      bookRemainingSec: 10,
      speed: 1,
      options: { skipBackSec: 15, skipForwardSec: 30, smartRewindSec: 5 },
    });
    expect(renderHook(() => useMiniPlayerActive()).result.current).toBe(true);
    expect(selectMiniPlayerActive()).toBe(true);
  });
});
