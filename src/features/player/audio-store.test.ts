import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useChromePlayerStore, useIsPlaying } from './chrome-store';

describe('chrome playing flag', () => {
  it('tracks isPlaying from chrome store', () => {
    useChromePlayerStore.getState().setChrome(
      {
        bookId: 'b1',
        title: 'T',
        subtitle: 'Ch',
        playing: true,
        positionSec: 0,
        durationSec: 10,
        skipBackSec: 15,
      },
      true,
    );
    expect(renderHook(() => useIsPlaying()).result.current).toBe(true);
    useChromePlayerStore.getState().clear();
    expect(renderHook(() => useIsPlaying()).result.current).toBe(false);
  });
});
