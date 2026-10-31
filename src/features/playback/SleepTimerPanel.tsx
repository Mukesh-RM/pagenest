import { useEffect, useState } from 'react';
import { Button, Chip, ChipGroup } from '@/ui';
import type { AudioController, SleepTimerSpec } from '@/engines/audio/types';
import { formatClock } from '@/engines/audio/util';
import { useServices } from '@/app/services-context';
import { usePlayerStore } from '@/features/player/audio-store';
import { loadLastSleepTimerSpec, persistLastSleepTimerSpec } from './sleep-settings';
import {
  parseCustomSleepMinutes,
  SLEEP_PRESET_MINUTES,
  sleepSpecLabel,
} from './sleep-timer-presets';

export function SleepTimerPanel({
  controller,
  onApplied,
}: {
  controller: AudioController;
  onApplied?: () => void;
}) {
  const state = usePlayerStore((s) => s.state);
  const { db } = useServices();
  const [lastSpec, setLastSpec] = useState<SleepTimerSpec | undefined>();
  const [customMinutes, setCustomMinutes] = useState('');

  useEffect(() => {
    void loadLastSleepTimerSpec(db).then(setLastSpec);
  }, [db]);

  const apply = (spec: SleepTimerSpec | null) => {
    controller.setSleepTimer(spec);
    if (spec) {
      setLastSpec(spec);
      void persistLastSleepTimerSpec(db, spec);
    }
    onApplied?.();
  };

  const applyCustom = () => {
    const minutes = parseCustomSleepMinutes(customMinutes);
    if (minutes === undefined) return;
    apply({ kind: 'minutes', minutes });
  };

  return (
    <>
      {state.sleep ? (
        <p className="mb-3 text-base text-muted" data-testid="player-sleep-active">
          {formatClock(state.sleep.remainingSec)} remaining
          {state.sleep.fading ? ' · fading out' : ''}
        </p>
      ) : null}
      {lastSpec && !state.sleep ? (
        <div className="mb-3">
          <Button
            variant="secondary"
            data-testid="sleep-repeat-last"
            onClick={() => apply(lastSpec)}
          >
            Start again: {sleepSpecLabel(lastSpec)}
          </Button>
        </div>
      ) : null}
      <ChipGroup label="Sleep timer">
        {SLEEP_PRESET_MINUTES.map((m) => (
          <Chip
            key={m}
            selected={
              state.sleep?.spec.kind === 'minutes' && state.sleep.spec.minutes === m
            }
            onClick={() => apply({ kind: 'minutes', minutes: m })}
          >
            {m} min
          </Chip>
        ))}
        <Chip
          selected={state.sleep?.spec.kind === 'endOfChapter'}
          onClick={() => apply({ kind: 'endOfChapter' })}
        >
          End of chapter
        </Chip>
        {state.sleep ? (
          <Chip selected onClick={() => apply(null)}>
            Turn off
          </Chip>
        ) : null}
      </ChipGroup>
      <div className="mt-4 flex flex-wrap items-end gap-2" data-testid="sleep-custom-row">
        <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-base">
          Custom (minutes)
          <input
            className="min-h-touch rounded-card border border-[rgb(var(--pn-accent-rgb)/0.35)] bg-surface px-3 py-2 text-base text-[var(--pn-text)]"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label="Custom sleep timer minutes"
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
          />
        </label>
        <Button variant="secondary" onClick={applyCustom}>
          Set custom
        </Button>
      </div>
      <p className="mt-3 text-base text-muted">Shake the device to add 5 minutes while the timer runs.</p>
    </>
  );
}
