import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlayPauseGlyph, SkipGlyph } from '@/ui/components/PlayGlyphs';
import type { AudioController } from '@/engines/audio/types';
import { chapterSubtitle } from '@/engines/audio/media-session';
import { formatSpeed, timeLeftLabel } from '@/ui/utils/time';
import { usePlayerStore } from '@/features/player/audio-store';
import { SharedSleepTimerSheet } from '@/features/playback/SharedSleepTimerSheet';
import './drive-mode.css';

const DRIVE_SKIP_SEC = 30;
const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

export interface DriveModeViewProps {
  readonly controller: AudioController;
  readonly onExit: () => void;
}

function useScreenWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;
    let lock: WakeLockSentinel | undefined;
    void navigator.wakeLock.request('screen').then((sentinel) => {
      lock = sentinel;
    }).catch(() => undefined);
    return () => {
      void lock?.release();
    };
  }, [active]);
}

function sleepChipLabel(sleep?: { spec: { kind: string; minutes?: number }; remainingSec: number }): string {
  if (!sleep) return 'Sleep off';
  if (sleep.spec.kind === 'endOfChapter') return 'Sleep: end chapter';
  if (sleep.spec.kind === 'minutes' && sleep.spec.minutes) return `Sleep: ${sleep.spec.minutes} min`;
  return 'Sleep on';
}

export default function DriveModeView({ controller, onExit }: DriveModeViewProps) {
  const state = usePlayerStore((s) => s.state);
  const [sleepOpen, setSleepOpen] = useState(false);
  useScreenWakeLock(true);

  const playing = state.status === 'playing';
  const title = state.item?.title ?? 'Audiobook';
  const chapterLine = state.item ? chapterSubtitle(state) : '';
  const timeLeft = useMemo(
    () => timeLeftLabel(state.durationSec, state.positionSec, state.speed),
    [state.durationSec, state.positionSec, state.speed],
  );

  const cycleSpeed = useCallback(() => {
    const idx = SPEED_STEPS.indexOf(state.speed as (typeof SPEED_STEPS)[number]);
    const next = SPEED_STEPS[(idx < 0 ? 2 : idx + 1) % SPEED_STEPS.length] ?? 1;
    controller.setSpeed(next);
  }, [controller, state.speed]);

  return (
  <>
    <div className="pn-drive" role="dialog" aria-modal="true" aria-label="Drive mode" data-testid="drive-mode">
      <button type="button" className="pn-drive__exit" onClick={onExit} aria-label="Exit drive mode">
        Exit
      </button>

      <header className="pn-drive__header">
        <h1 className="pn-drive__title">{title}</h1>
        {chapterLine ? <p className="pn-drive__meta">{chapterLine}</p> : null}
        <p className="pn-drive__meta pn-drive__time" aria-live="polite">
          {timeLeft}
        </p>
      </header>

      <div className="pn-drive__grid" aria-label="Playback">
        <div className="pn-drive__row pn-drive__row--transport">
          <button
            type="button"
            className="pn-drive__cell pn-drive__cell--skip"
            aria-label={`Back ${DRIVE_SKIP_SEC} seconds`}
            onClick={() => controller.skip(-DRIVE_SKIP_SEC)}
          >
            <SkipGlyph direction="back" seconds={DRIVE_SKIP_SEC} size={52} />
          </button>
          <button
            type="button"
            className="pn-drive__cell pn-drive__cell--play"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={() => void controller.toggle()}
          >
            <PlayPauseGlyph playing={playing} size={56} />
          </button>
          <button
            type="button"
            className="pn-drive__cell pn-drive__cell--skip"
            aria-label={`Forward ${DRIVE_SKIP_SEC} seconds`}
            onClick={() => controller.skip(DRIVE_SKIP_SEC)}
          >
            <SkipGlyph direction="forward" seconds={DRIVE_SKIP_SEC} size={52} />
          </button>
        </div>

        <div className="pn-drive__row pn-drive__row--chapters">
          <button
            type="button"
            className="pn-drive__cell"
            aria-label="Previous chapter"
            onClick={() => controller.previousChapter()}
          >
            <span className="pn-drive__cell-icon" aria-hidden="true">
              ‹‹
            </span>
            <span className="pn-drive__cell-label">Prev chapter</span>
          </button>
          <button
            type="button"
            className="pn-drive__cell"
            aria-label="Next chapter"
            onClick={() => controller.nextChapter()}
          >
            <span className="pn-drive__cell-icon" aria-hidden="true">
              ››
            </span>
            <span className="pn-drive__cell-label">Next chapter</span>
          </button>
        </div>

        <div className="pn-drive__row pn-drive__row--extras">
          <button type="button" className="pn-drive__pill" aria-label={`Speed ${formatSpeed(state.speed)}. Change speed`} onClick={cycleSpeed}>
            Speed {formatSpeed(state.speed)}
          </button>
          <button
            type="button"
            className="pn-drive__pill"
            aria-label={`${sleepChipLabel(state.sleep)}. Open sleep timer`}
            onClick={() => setSleepOpen(true)}
          >
            {sleepChipLabel(state.sleep)}
          </button>
        </div>
      </div>
    </div>
    <SharedSleepTimerSheet open={sleepOpen} onClose={() => setSleepOpen(false)} controller={controller} />
  </>
  );
}
