import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useChromePlayerStore } from './chrome-store';
import { miniPlayerSlot, useMiniPlayerActive } from './mini-player-slot';
import { selectMiniPlayerActive } from './audio-store';

describe('miniPlayerSlot', () => {
  it('exposes Component and useActive', () => {
    expect(miniPlayerSlot.Component).toBeTypeOf('function');
    expect(miniPlayerSlot.useActive).toBe(useMiniPlayerActive);
  });

  it('useMiniPlayerActive tracks chrome session', () => {
    useChromePlayerStore.getState().clear();
    expect(renderHook(() => useMiniPlayerActive()).result.current).toBe(false);
    expect(selectMiniPlayerActive()).toBe(false);

    useChromePlayerStore.getState().setChrome(
      {
        bookId: 'b1',
        title: 'Test',
        subtitle: 'Ch 1',
        playing: false,
        positionSec: 0,
        durationSec: 10,
        skipBackSec: 15,
      },
      true,
    );
    expect(renderHook(() => useMiniPlayerActive()).result.current).toBe(true);
    expect(selectMiniPlayerActive()).toBe(true);
  });
});
