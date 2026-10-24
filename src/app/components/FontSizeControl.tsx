import { useId } from 'react';
import { FONT_SIZE_MAX, FONT_SIZE_MIN } from '../font-size';
import { useServices } from '../services-context';
import { useSettings } from '../settings-store';

/**
 * Text size slider bound to the saved `fontSizePx` setting. Used by Onboarding
 * and Settings so both always show and change the same value. Native range
 * input, so arrow keys, Home and End work and screen readers announce it.
 */
export function FontSizeControl() {
  const { db } = useServices();
  const size = useSettings((s) => s.fontSizePx);
  const setSize = useSettings((s) => s.setFontSizePx);
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-baseline justify-between font-medium">
        <span>Text size</span>
        <span className="text-muted" aria-hidden="true">
          {size} px
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={FONT_SIZE_MIN}
        max={FONT_SIZE_MAX}
        step={1}
        value={size}
        aria-valuetext={`${size} pixels`}
        onChange={(e) => void setSize(db, Number(e.target.value))}
        className="h-touch w-full accent-[rgb(var(--pn-accent))]"
      />
    </div>
  );
}
