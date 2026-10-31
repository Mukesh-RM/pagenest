import { useCallback, useEffect, useMemo } from 'react';
import { PlayPauseGlyph, SkipGlyph } from '@/ui/components/PlayGlyphs';
import type { AudioController } from '@/engines/audio/types';
import { chapterSubtitle } from '@/engines/audio/media-session';
import { formatSpeed, timeLeftLabel } from '@/ui/utils/time';
import { usePlayerStore } from '@/features/player/audio-store';
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

export default function DriveModeView({ controller, onExit }: DriveModeViewProps) {
  const state = usePlayerStore((s) => s.state);
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
    <div className="pn-drive" role="dialog" aria-modal="true" aria-label="Drive mode" data-testid="drive-mode">
      <header className="pn-drive__header">
        <div className="pn-drive__titles">
          <h1 className="pn-drive__title">{title}</h1>
          {chapterLine ? <p className="pn-drive__meta">{chapterLine}</p> : null}
          <p className="pn-drive__meta" aria-live="polite">
            {timeLeft}
          </p>
        </div>
        <button type="button" className="pn-drive__btn pn-drive__exit" onClick={onExit}>
          Exit
        </button>
      </header>

      <div className="pn-drive__main">
        <div className="pn-drive__transport" aria-label="Playback">
          <button
            type="button"
            className="pn-drive__btn pn-drive__btn--ghost"
            aria-label="Previous chapter"
            onClick={() => controller.previousChapter()}
          >
            Prev chapter
          </button>
          <button
            type="button"
            className="pn-drive__btn pn-drive__btn--ghost"
            aria-label={`Back ${DRIVE_SKIP_SEC} seconds`}
            onClick={() => controller.skip(-DRIVE_SKIP_SEC)}
          >
            <SkipGlyph direction="back" seconds={DRIVE_SKIP_SEC} size={56} />
          </button>
          <button
            type="button"
            className="pn-drive__btn pn-drive__btn--primary"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={() => void controller.toggle()}
          >
            <PlayPauseGlyph playing={playing} size={48} />
          </button>
          <button
            type="button"
            className="pn-drive__btn pn-drive__btn--ghost"
            aria-label={`Forward ${DRIVE_SKIP_SEC} seconds`}
            onClick={() => controller.skip(DRIVE_SKIP_SEC)}
          >
            <SkipGlyph direction="forward" seconds={DRIVE_SKIP_SEC} size={56} />
          </button>
          <button
            type="button"
            className="pn-drive__btn pn-drive__btn--ghost"
            aria-label="Next chapter"
            onClick={() => controller.nextChapter()}
          >
            Next chapter
          </button>
        </div>
        <button
          type="button"
          className="pn-drive__btn pn-drive__speed"
          aria-label={`Speed ${formatSpeed(state.speed)}. Change speed`}
          onClick={cycleSpeed}
        >
          Speed {formatSpeed(state.speed)}
        </button>
      </div>
    </div>
  );
}
