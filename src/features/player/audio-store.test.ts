import { describe, expect, it } from 'vitest';
import { usePlayerStore } from './audio-store';

describe('usePlayerStore', () => {
  it('tracks isPlaying from status', () => {
    usePlayerStore.getState().setState({
      status: 'playing',
      positionSec: 0,
      durationSec: 10,
      chapterIndex: 0,
      chapterRemainingSec: 10,
      bookRemainingSec: 10,
      speed: 1,
      options: { skipBackSec: 15, skipForwardSec: 30, smartRewindSec: 5 },
    });
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });
});
