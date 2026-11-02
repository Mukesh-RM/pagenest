import { useEffect } from 'react';

/**
 * Keeps the screen awake during playback (audiobook or read-aloud) so background/locked playback is less likely to stall.
 * Browsers may still suspend without Media Session; pair with {@link syncNarrationMediaSession} for TTS.
 */
export function usePlaybackWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;
    let lock: WakeLockSentinel | undefined;
    void navigator.wakeLock
      .request('screen')
      .then((sentinel) => {
        lock = sentinel;
      })
      .catch(() => undefined);
    return () => {
      void lock?.release();
      lock = undefined;
    };
  }, [active]);
}
