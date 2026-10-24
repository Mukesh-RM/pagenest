import { TextSizeControl } from '@/ui/components/TextSizeControl';
import { clampFontSize } from '../font-size';
import { useServices } from '../services-context';
import { useSettings } from '../settings-store';

/**
 * Text size control bound to the saved `fontSizePx` setting (88 % to 200 %), built on the design
 * system's `TextSizeControl` (smaller and larger buttons around a native range). Used by Onboarding and
 * Settings so both always show and change the same value. The root size is applied by `ThemeProvider`.
 */
export function FontSizeControl() {
  const { db } = useServices();
  const size = useSettings((s) => s.fontSizePx);
  const setSize = useSettings((s) => s.setFontSizePx);
  return <TextSizeControl value={size} onChange={(px) => void setSize(db, clampFontSize(px))} />;
}
