import { Button } from '../components/Button';
import { useId } from 'react';
import { cx } from '../utils/cx';
import { Icon } from '../icons';
import type { VoiceOption } from '../types';
import '../styles/screens.css';
import '../styles/surfaces.css';

export interface VoiceStudioScreenProps {
  voices: readonly VoiceOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Play a short sample of this voice. */
  onPreview: (voice: VoiceOption) => void;
  /** Id of the voice whose sample is playing, if any. */
  previewingId?: string;
  onNext: () => void;
  onBack: () => void;
  step?: number;
  steps?: number;
}

/**
 * Voice Studio, step 1 of 3: pick a voice. Voices are radio options with a sample button each, so choosing never
 * means guessing from a name. Presentational: the voice engine supplies voices and plays samples.
 */
export function VoiceStudioScreen({
  voices,
  selectedId,
  onSelect,
  onPreview,
  previewingId,
  onNext,
  onBack,
  step = 1,
  steps = 3,
}: VoiceStudioScreenProps) {
  const groupName = useId();
  const selected = voices.find((v) => v.id === selectedId);
  return (
    <div className="pn-screen pn-voice">
      <header className="pn-screen__header">
        <Button iconOnly variant="ghost" icon="arrowLeft" aria-label="Back" onClick={onBack} />
        <p className="pn-voice__step" aria-label={`Step ${step} of ${steps}`}>
          Step {step} of {steps}
        </p>
      </header>
      <h1 className="pn-screen__title">Pick a voice</h1>
      <p className="pn-voice__intro">Listen to each one, then choose the voice that feels right for long reading. You can change it any time.</p>

      <fieldset className="pn-voice__list">
        <legend className="pn-visually-hidden">Voices</legend>
        {voices.map((v) => (
          <div key={v.id} className={cx('pn-voice__item', v.id === selectedId && 'pn-voice__item--checked')}>
            <label className="pn-voice__choice">
              <input
                type="radio"
                name={groupName}
                className="pn-voice__radio"
                checked={v.id === selectedId}
                onChange={() => onSelect(v.id)}
              />
              <span className="pn-voice__info">
                <span className="pn-voice__name">{v.name}</span>
                <span className="pn-voice__meta">
                  <span>{v.language}</span>
                  <span>{v.quality}</span>
                  {v.installed ? <span>Ready offline</span> : v.size ? <span>{v.size} download</span> : null}
                </span>
              </span>
            </label>
            <Button
              iconOnly
              variant="secondary"
              icon={previewingId === v.id ? 'pause' : 'play'}
              onClick={() => onPreview(v)}
              aria-label={`${previewingId === v.id ? 'Stop sample of' : 'Play sample of'} ${v.name}`}
            />
          </div>
        ))}
      </fieldset>

      <footer className="pn-voice__footer">
        <p className="pn-voice__chosen">
          <Icon name="mic" size={20} />
          <span>{selected ? `${selected.name} selected` : 'No voice selected'}</span>
        </p>
        <Button onClick={onNext} disabled={!selected}>
          Next
        </Button>
      </footer>
    </div>
  );
}

export default VoiceStudioScreen;
