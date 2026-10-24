import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { createAudioController, createAudioElement } from '@/engines/audio';
import type { AudioController } from '@/engines/audio/types';
import type { ProgressService } from '@/app/contracts';
import { useServices } from '@/app/services-context';
import { usePlayerStore } from './audio-store';
import { attachPlayerKeyboard } from './keyboard-shortcuts';
import { MiniPlayerHost } from './MiniPlayerHost';
import { FullPlayerSheet } from './FullPlayerSheet';

let sharedAudio: HTMLAudioElement | undefined;
let sharedController: AudioController | undefined;

export function getAudioController(): AudioController | undefined {
  return sharedController;
}

function ensureController(progress: ProgressService): AudioController {
  if (!sharedAudio) sharedAudio = createAudioElement();
  if (!sharedController) sharedController = createAudioController({ audio: sharedAudio, progress });
  return sharedController;
}

/**
 * Owns the single audio element, syncs Zustand, renders mini and full player chrome.
 * Mount once near the app root (Architect: wrap inside AppShell).
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const { progress } = useServices();
  const controller = useMemo(() => ensureController(progress), [progress]);
  const setState = usePlayerStore((s) => s.setState);
  const detachKeyboard = useRef<(() => void) | undefined>();

  useEffect(() => {
    return controller.subscribe((state) => setState(state));
  }, [controller, setState]);

  useEffect(() => {
    detachKeyboard.current = attachPlayerKeyboard(controller);
    return () => detachKeyboard.current?.();
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

  return (
    <>
      {children}
      <MiniPlayerHost controller={controller} />
      <FullPlayerSheet controller={controller} />
    </>
  );
}
