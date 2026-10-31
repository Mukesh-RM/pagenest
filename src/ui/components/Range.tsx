import type { CSSProperties } from 'react';
import { cx } from '../utils/cx';

export interface RangeProps {
  /** Accessible name: "Text size", "Playback position". */
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Spoken value, for example "12 minutes of 9 hours". Defaults to the number. */
  valueText?: string;
  /** Fires when the user lets go (commit a seek). */
  onCommit?: (value: number) => void;
  className?: string;
}

/**
 * Native range input with the InkQuiet look: 44 px tall hit area, a thin teal track filled up to the thumb, a
 * 20 px thumb, full keyboard and screen-reader support from the platform. The fill is a gradient driven by a CSS
 * variable, so it needs no layout and no animation.
 */
export function Range({ label, value, min, max, step = 1, onChange, valueText, onCommit, className }: RangeProps) {
  const span = max - min;
  const percent = span > 0 ? Math.min(100, Math.max(0, ((value - min) / span) * 100)) : 0;
  const style = { '--pn-range-fill': `${percent}%` } as CSSProperties;
  return (
    <input
      type="range"
      aria-label={label}
      aria-valuetext={valueText}
      className={cx('pn-range', className)}
      style={style}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      onPointerUp={onCommit ? (event) => onCommit(Number(event.currentTarget.value)) : undefined}
      onKeyUp={onCommit ? (event) => onCommit(Number(event.currentTarget.value)) : undefined}
    />
  );
}
