import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { ProgressService } from '@/app/contracts';
import type { AudioController } from '@/engines/audio/types';
import { useServices } from '@/app/services-context';
import { createDeferredAudioController } from './deferred-audio-controller';
import { useChromePlayerStore } from './chrome-store';
import { useEnginePlayerStore } from './engine-store';
import { chromeSnapshotFromAudioState, resetChromeCoverCacheForTests } from './sync-chrome-from-engine';
import { attachPlayerKeyboard } from './keyboard-shortcuts';

const AudioControllerContext = createContext<AudioController | undefined>(undefined);

let sharedAudio: HTMLAudioElement | undefined;
let sharedController: AudioController | undefined;

export function getAudioController(): AudioController | undefined {
  return sharedController;
}

export function getSharedAudioElement(): HTMLAudioElement | undefined {
  return sharedAudio;
}

/** Test-only: drop the singleton between cases. */
export function resetAudioForTests(): void {
  sharedController = undefined;
  sharedAudio = undefined;
  useChromePlayerStore.getState().clear();
  resetChromeCoverCacheForTests();
}

export function useAudioController(): AudioController {
  const controller = useContext(AudioControllerContext);
  if (!controller) throw new Error('useAudioController must be used inside <PlayerProvider>.');
  return controller;
}

/**
 * Owns the single audio element and Zustand sync. Register {@link miniPlayerSlot} in AppServices.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const { progress } = useServices();
  const controller = useMemo(() => {
    const deferred = createDeferredAudioController(progress, (audio, active) => {
      sharedAudio = audio;
      sharedController = active;
    });
    sharedController = deferred;
    return deferred;
  }, [progress]);
  const setEngineState = useEnginePlayerStore((s) => s.setState);
  const setChrome = useChromePlayerStore((s) => s.setChrome);

  useEffect(
    () =>
      controller.subscribe((state) => {
        setEngineState(state);
        const { chrome, sessionActive } = chromeSnapshotFromAudioState(state);
        setChrome(chrome, sessionActive);
      }),
    [controller, setEngineState, setChrome],
  );

  useEffect(() => {
    const detach = attachPlayerKeyboard(controller);
    return detach;
  }, [controller]);

  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    const unsub = useChromePlayerStore.subscribe((s) => {
      if (s.chrome.playing && 'wakeLock' in navigator) {
        void navigator.wakeLock.request('screen').then((sentinel) => {
          lock = sentinel;
        }).catch(() => undefined);
      } else {
        void lock?.release();
        lock = undefined;
      }
    });
    return () => {
      unsub();
      void lock?.release();
    };
  }, []);

  return <AudioControllerContext.Provider value={controller}>{children}</AudioControllerContext.Provider>;
}
