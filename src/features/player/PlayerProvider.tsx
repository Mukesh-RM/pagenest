import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { createAudioController, createAudioElement } from '@/engines/audio';
import type { AudioController } from '@/engines/audio/types';
import { useServices } from '@/app/services-context';
import { usePlayerStore } from './audio-store';
import { attachPlayerKeyboard } from './keyboard-shortcuts';

const AudioControllerContext = createContext<AudioController | undefined>(undefined);

let sharedAudio: HTMLAudioElement | undefined;
let sharedController: AudioController | undefined;

export function getAudioController(): AudioController | undefined {
  return sharedController;
}

function ensureController(progress: import('@/app/contracts').ProgressService): AudioController {
  if (!sharedAudio) sharedAudio = createAudioElement();
  if (!sharedController) sharedController = createAudioController({ audio: sharedAudio, progress });
  return sharedController;
}

export function useAudioController(): AudioController {
  const controller = useContext(AudioControllerContext);
  if (!controller) throw new Error('useAudioController must be used inside <PlayerProvider>.');
  return controller;
}

/**
 * Owns the single audio element and Zustand sync. Render {@link PlayerChrome} inside a Router.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const { progress } = useServices();
  const controller = useMemo(() => ensureController(progress), [progress]);
  const setState = usePlayerStore((s) => s.setState);

  useEffect(() => controller.subscribe((state) => setState(state)), [controller, setState]);

  useEffect(() => {
    const detach = attachPlayerKeyboard(controller);
    return detach;
  }, [controller]);

  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    const unsub = usePlayerStore.subscribe((s) => {
      if (s.isPlaying && 'wakeLock' in navigator) {
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
