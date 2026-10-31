import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface ReaderScrubberProps {
  /** Current position, 0 to 1 through the book. */
  readonly value: number;
  /** Chapter starts as fractions of the whole book (ticks on the track). */
  readonly ticks?: readonly number[];
  /** Spoken value, for example "Page 5 of 39" or "42 percent". */
  readonly valueText: string;
  readonly disabled?: boolean;
  /** Called while dragging with the fraction under the thumb. */
  readonly onPreview?: (fraction: number) => void;
  /** Called once the reader settles on a spot. */
  readonly onCommit: (fraction: number) => void;
}

const STEPS = 1000;
const SETTLE_MS = 140;

/** Book scrubber: drag to jump, ticks mark chapter starts. Keyboard: Page Up/Down jump by a tenth. */
export function ReaderScrubber({ value, ticks = [], valueText, disabled, onPreview, onCommit }: ReaderScrubberProps) {
  const [drag, setDrag] = useState<number>();
  const timer = useRef(0);
  const release = useRef(0);
  const shown = drag ?? value;

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(release.current);
    },
    [],
  );

  const commit = (fraction: number): void => {
    window.clearTimeout(timer.current);
    onCommit(fraction);
    window.clearTimeout(release.current);
    release.current = window.setTimeout(() => setDrag(undefined), 450);
  };

  const change = (raw: number): void => {
    const fraction = Math.min(1, Math.max(0, raw / STEPS));
    setDrag(fraction);
    onPreview?.(fraction);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => commit(fraction), SETTLE_MS);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      change(Math.min(STEPS, Math.max(0, shown * STEPS + (event.key === 'PageUp' ? 100 : -100))));
    }
  };

  return (
    <div className="pn-scrubber" data-disabled={disabled ? 'true' : undefined}>
      <div className="pn-scrubber__ticks" aria-hidden="true">
        {ticks.map((t, i) => (
          <span key={`${i}-${t}`} className="pn-scrubber__tick" style={{ ['--t' as string]: Math.min(1, Math.max(0, t)) }} />
        ))}
      </div>
      <input
        type="range"
        className="pn-scrubber__input"
        min={0}
        max={STEPS}
        step={1}
        value={Math.round(shown * STEPS)}
        disabled={disabled}
        aria-label="Position in the book"
        aria-valuetext={valueText}
        style={{ ['--f' as string]: shown }}
        onChange={(e) => change(Number(e.currentTarget.value))}
        onKeyDown={onKeyDown}
        onPointerUp={() => drag !== undefined && commit(drag)}
        onBlur={() => drag !== undefined && commit(drag)}
      />
    </div>
  );
}
