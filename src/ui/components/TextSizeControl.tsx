import { useId } from 'react';
import { Button } from './Button';
import { Range } from './Range';
import { cx } from '../utils/cx';
import { TEXT_SIZE_MAX, TEXT_SIZE_MIN, TEXT_SIZE_STEP, clampTextSize, textSizePercent } from '../utils/textSize';

export interface TextSizeControlProps {
  /** Text size in px (14 to 32 on a 16 px base). */
  value: number;
  onChange: (px: number) => void;
  className?: string;
}

/**
 * App text size slider: smaller / larger buttons around a native range, from 87% to 200%. The label and the percent sit
 * on their own row so nothing overflows at 200%; the sample line shows the size live.
 */
export function TextSizeControl({ value, onChange, className }: TextSizeControlProps) {
  const id = useId();
  const size = clampTextSize(value);
  return (
    <div className={cx('pn-textsize', className)}>
      <div className="pn-textsize__head">
        <span id={id} className="pn-textsize__label">
          Text size
        </span>
        <span className="pn-textsize__value" aria-hidden="true">
          {textSizePercent(size)}
        </span>
      </div>
      <div className="pn-textsize__row">
        <Button iconOnly variant="ghost" icon="minus" aria-label="Smaller text" disabled={size <= TEXT_SIZE_MIN} onClick={() => onChange(clampTextSize(size - TEXT_SIZE_STEP * 2))} />
        <Range label="Text size" min={TEXT_SIZE_MIN} max={TEXT_SIZE_MAX} step={TEXT_SIZE_STEP} value={size} valueText={`${textSizePercent(size)}, ${size} pixels`} onChange={(px) => onChange(clampTextSize(px))} />
        <Button iconOnly variant="ghost" icon="plus" aria-label="Larger text" disabled={size >= TEXT_SIZE_MAX} onClick={() => onChange(clampTextSize(size + TEXT_SIZE_STEP * 2))} />
      </div>
    </div>
  );
}
