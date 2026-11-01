import { Button } from '@/ui/components/Button';
import type { NarrationSettings } from './types';
import './narration.css';

export interface NarrationControlsProps {
  readonly settings: NarrationSettings;
  readonly playing: boolean;
  readonly preparing: boolean;
  readonly sleepLabel?: string;
  readonly prepMessage?: string;
  readonly error?: string;
  readonly onPlayPause: () => void;
  readonly onSpeed: (speed: number) => void;
  readonly onVoice: () => void;
  readonly onExpressive: (on: boolean) => void;
  readonly onCast?: (on: boolean) => void;
  readonly onSleep?: () => void;
  readonly onDriveMode?: () => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

export function NarrationControls({
  settings,
  playing,
  preparing,
  sleepLabel = 'Off',
  prepMessage,
  error,
  onPlayPause,
  onSpeed,
  onVoice,
  onExpressive,
  onCast,
  onSleep,
  onDriveMode,
}: NarrationControlsProps) {
  return (
    <section className="pn-narration" aria-label="Read aloud controls">
      {error ? (
        <p className="pn-narration__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="pn-narration__row">
        <Button
          variant="primary"
          icon={playing ? 'pause' : 'play'}
          aria-label={playing ? 'Pause read aloud' : 'Start read aloud'}
          disabled={preparing}
          onClick={onPlayPause}
        >
          {playing ? 'Pause' : preparing ? prepMessage ?? 'Starting…' : 'Read aloud'}
        </Button>
        <Button variant="secondary" aria-label="Choose voice" onClick={onVoice}>
          Voice
        </Button>
        {onSleep ? (
          <Button variant="secondary" icon="timer" aria-label={`Sleep timer: ${sleepLabel}. Change`} onClick={onSleep}>
            Sleep: {sleepLabel}
          </Button>
        ) : null}
        {onDriveMode ? (
          <Button variant="secondary" icon="headphones" aria-label="Open drive mode" onClick={onDriveMode}>
            Drive mode
          </Button>
        ) : null}
        <label className="pn-narration__chip">
          <input
            type="checkbox"
            checked={settings.expressive || settings.style === 'expressive'}
            onChange={(e) => onExpressive(e.target.checked)}
          />
          Expressive
        </label>
        {onCast ? (
          <label className="pn-narration__chip">
            <input
              type="checkbox"
              checked={settings.style === 'cast'}
              onChange={(e) => onCast(e.target.checked)}
            />
            Cast voices
          </label>
        ) : null}
      </div>
      <div className="pn-narration__speeds" role="group" aria-label="Playback speed">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={`pn-narration__speed${settings.speed === s ? ' pn-narration__speed--active' : ''}`}
            aria-pressed={settings.speed === s}
            onClick={() => onSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>
    </section>
  );
}
