import type { CSSProperties } from 'react';
import { cx } from '../utils/cx';

export interface ProgressBarProps {
  /** 0 to 1. */
  value: number;
  /** Accessible name, for example "Reading progress". */
  label: string;
  className?: string;
}

/** Thin progress bar shown under every cover. */
export function ProgressBar({ value, label, className }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const style = { '--pn-progress': String(clamped) } as CSSProperties;
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={cx('pn-progress', className)}
    >
      <span className="pn-progress__fill" style={style} />
    </span>
  );
}
