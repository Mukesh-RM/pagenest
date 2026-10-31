import { BottomSheet, Button, Chip, ChipGroup } from '@/ui';
import type { AudioController } from '@/engines/audio/types';
import { formatClock } from '@/engines/audio/util';
import { usePlayerStore } from './audio-store';
const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const SLEEP_MINUTES = [5, 15, 30, 45, 60];

export function SleepTimerSheet({
  open,
  onClose,
  controller,
}: {
  open: boolean;
  onClose: () => void;
  controller: AudioController;
}) {
  const state = usePlayerStore((s) => s.state);
  return (
    <BottomSheet open={open} onClose={() => onClose()} title="Sleep timer">
      {state.sleep ? (
        <p className="mb-3 text-base text-muted" data-testid="player-sleep-active">
          {formatClock(state.sleep.remainingSec)} remaining
        </p>
      ) : null}
      <ChipGroup label="Sleep timer">
        {SLEEP_MINUTES.map((m) => (
          <Chip
            key={m}
            selected={state.sleep?.spec.kind === 'minutes' && state.sleep.spec.minutes === m}
            onClick={() => {
              controller.setSleepTimer({ kind: 'minutes', minutes: m });
              onClose();
            }}
          >
            {m} min
          </Chip>
        ))}
        <Chip
          selected={state.sleep?.spec.kind === 'endOfChapter'}
          onClick={() => {
            controller.setSleepTimer({ kind: 'endOfChapter' });
            onClose();
          }}
        >
          End of chapter
        </Chip>
        {state.sleep ? (
          <Chip
            selected
            onClick={() => {
              controller.setSleepTimer(null);
              onClose();
            }}
          >
            Turn off
          </Chip>
        ) : null}
      </ChipGroup>
    </BottomSheet>
  );
}

export function ChaptersSheet({
  open,
  onClose,
  controller,
}: {
  open: boolean;
  onClose: () => void;
  controller: AudioController;
}) {
  const state = usePlayerStore((s) => s.state);
  const item = state.item;
  if (!item) return null;
  return (
    <BottomSheet open={open} onClose={() => onClose()} title="Chapters">
      <ul className="flex flex-col gap-2">
        {item.chapters.map((ch) => (
          <li key={ch.index}>
            <button
              type="button"
              className="min-h-touch w-full rounded-card px-3 py-2 text-left hover:bg-surface-raised"
              aria-current={ch.index === state.chapterIndex ? 'true' : undefined}
              onClick={() => {
                controller.goToChapter(ch.index);
                onClose();
              }}
            >
              <span className="font-medium">{ch.title}</span>
              <span className="ml-2 text-sm text-muted">{formatClock(ch.startSec)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" onClick={() => controller.previousChapter()}>Previous</Button>
        <Button variant="secondary" onClick={() => controller.nextChapter()}>Next</Button>
      </div>
    </BottomSheet>
  );
}

/** Extra speed control sheet (opened from keyboard or future UI). */
export function SpeedSheet({
  open,
  onClose,
  controller,
}: {
  open: boolean;
  onClose: () => void;
  controller: AudioController;
}) {
  const state = usePlayerStore((s) => s.state);
  return (
    <BottomSheet open={open} onClose={() => onClose()} title="Playback speed">
      <section data-testid="player-speed-section">
        <ChipGroup label="Playback speed" scroll>
          {SPEED_STEPS.map((rate) => (
            <Chip
              key={rate}
              selected={state.speed === rate}
              onClick={() => {
                controller.setSpeed(rate);
                onClose();
              }}
            >
              {rate}x
            </Chip>
          ))}
        </ChipGroup>
        <p className="sr-only" data-testid="player-speed-display">{state.speed}x</p>
      </section>
    </BottomSheet>
  );
}
