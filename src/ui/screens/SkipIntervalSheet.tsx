import { BottomSheet } from '../components/BottomSheet';
import { ChoiceGroup } from '../components/ChoiceGroup';
import { SKIP_INTERVALS } from './playerOptions';

export interface SkipIntervalSheetProps {
  open: boolean;
  onClose: () => void;
  back: number;
  forward: number;
  /** Lengths on offer. A current value that is not in the list is added, so the choice always shows. */
  intervals?: readonly number[];
  onChange: (direction: 'back' | 'forward', seconds: number) => void;
}

function optionsFor(intervals: readonly number[], current: number) {
  const all = intervals.includes(current) ? [...intervals] : [...intervals, current].sort((a, b) => a - b);
  return all.map((n) => ({ value: String(n), label: `${n}`, ariaLabel: `${n} seconds` }));
}

/** "Skip buttons": how far Back and Forward jump, as two radio groups. Changes apply at once. */
export function SkipIntervalSheet({ open, onClose, back, forward, intervals = SKIP_INTERVALS, onChange }: SkipIntervalSheetProps) {
  return (
    <BottomSheet open={open} title="Skip buttons" onClose={() => onClose()} className="pn-skipsheet">
      <p className="pn-skipsheet__hint">How far each button jumps, in seconds. You can also hold a skip button on the player to open this.</p>
      <div className="pn-skipsheet__group">
        <p className="pn-skipsheet__label" id="pn-skip-back-label">
          Back
        </p>
        <ChoiceGroup label="Back, seconds" value={String(back)} options={optionsFor(intervals, back)} onChange={(v) => onChange('back', Number(v))} />
      </div>
      <div className="pn-skipsheet__group">
        <p className="pn-skipsheet__label" id="pn-skip-forward-label">
          Forward
        </p>
        <ChoiceGroup label="Forward, seconds" value={String(forward)} options={optionsFor(intervals, forward)} onChange={(v) => onChange('forward', Number(v))} />
      </div>
    </BottomSheet>
  );
}
