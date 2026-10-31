import { Button } from '@/ui/components/Button';
import type { NarrationSettings } from './types';
import './narration.css';

export interface NarrationControlsProps {
  readonly settings: NarrationSettings;
  readonly playing: boolean;
  readonly preparing: boolean;
  readonly onPlayPause: () => void;
  readonly onSpeed: (speed: number) => void;
  readonly onVoice: () => void;
  readonly onExpressive: (on: boolean) => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

export function NarrationControls({
  settings,
  playing,
  preparing,
  onPlayPause,
  onSpeed,
  onVoice,
  onExpressive,
}: NarrationControlsProps) {
  return (
    <section className="pn-narration" aria-label="Read aloud controls">
      <div className="pn-narration__row">
        <Button
          variant="primary"
          icon={playing ? 'pause' : 'play'}
          aria-label={playing ? 'Pause read aloud' : 'Start read aloud'}
          disabled={preparing}
          onClick={onPlayPause}
        >
          {playing ? 'Pause' : preparing ? 'Loading voice…' : 'Read aloud'}
        </Button>
        <Button variant="secondary" aria-label="Choose voice" onClick={onVoice}>
          Voice
        </Button>
        <label className="pn-narration__chip">
          <input
            type="checkbox"
            checked={settings.expressive || settings.style !== 'natural'}
            onChange={(e) => onExpressive(e.target.checked)}
          />
          Expressive
        </label>
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
