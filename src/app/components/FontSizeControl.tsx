import { Range } from '@/ui';
import { fontScalePercent } from '../apply-theme';
import { FONT_SIZE_MAX, FONT_SIZE_MIN } from '../font-size';
import { useServices } from '../services-context';
import { useSettings } from '../settings-store';

/**
 * Text size slider bound to the saved `fontSizePx` setting (88 % to 200 %). Used by Onboarding and
 * Settings so both always show and change the same value. The design system's `Range` is a native
 * range input, so arrow keys, Home and End work and screen readers announce it.
 */
export function FontSizeControl() {
  const { db } = useServices();
  const size = useSettings((s) => s.fontSizePx);
  const setSize = useSettings((s) => s.setFontSizePx);
  const percent = fontScalePercent(size);
  return (
    <div>
      <p className="mb-1 flex items-baseline justify-between font-semibold">
        <span>Text size</span>
        <span className="text-muted" aria-hidden="true">
          {percent}%
        </span>
      </p>
      <Range
        label="Text size"
        min={FONT_SIZE_MIN}
        max={FONT_SIZE_MAX}
        step={1}
        value={size}
        valueText={`${percent} percent`}
        onChange={(px) => void setSize(db, px)}
      />
    </div>
  );
}
