import { useCallback, useMemo } from 'react';
import type { AudioPlayerController } from '@/ui/screens/AudioPlayerScreen';
import type { AudioController } from '@/engines/audio/types';
import { formatClock } from '@/engines/audio/util';
import { usePlayerStore } from './audio-store';

const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

function sleepLabelFromState(sleep?: { spec: { kind: string; minutes?: number }; remainingSec: number }): string {
  if (!sleep) return 'Off';
  if (sleep.spec.kind === 'endOfChapter') return 'End of chapter';
  if (sleep.spec.kind === 'minutes' && sleep.spec.minutes) return `${sleep.spec.minutes} min`;
  return formatClock(sleep.remainingSec);
}

export type PlayerSheet = 'sleep' | 'chapters' | 'bookmarks' | null;

export function useAudioPlayerController(
  controller: AudioController,
  openSheet: (sheet: Exclude<PlayerSheet, null>) => void,
): AudioPlayerController {
  const state = usePlayerStore((s) => s.state);

  const cycleSpeed = useCallback(() => {
    const idx = SPEED_STEPS.indexOf(state.speed as (typeof SPEED_STEPS)[number]);
    const next = SPEED_STEPS[(idx < 0 ? 2 : idx + 1) % SPEED_STEPS.length] ?? 1;
    controller.setSpeed(next);
  }, [controller, state.speed]);

  return useMemo(
    () => ({
      playing: state.status === 'playing',
      position: state.positionSec,
      duration: state.durationSec,
      speed: state.speed,
      sleepLabel: sleepLabelFromState(state.sleep),
      toggle: () => void controller.toggle(),
      seek: (seconds: number) => controller.seekTo(seconds),
      skip: (deltaSeconds: number) => controller.skip(deltaSeconds),
      cycleSpeed,
      openSleep: () => openSheet('sleep'),
      openChapters: () => openSheet('chapters'),
    }),
    [controller, cycleSpeed, openSheet, state.durationSec, state.positionSec, state.sleep, state.speed, state.status],
  );
}
