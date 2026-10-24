import { memo, useCallback } from 'react';
import { ChoiceGroup, type ChoiceOption } from '@/ui';
import { useServices } from '../services-context';
import { useSettings } from '../settings-store';
import { THEME_LABELS, THEMES, type ThemePreference } from '../themes';

/** The four themes with a small preview of their own page and accent colors, then "Match my phone". */
const OPTIONS: ReadonlyArray<ChoiceOption<ThemePreference>> = [
  ...(['light', 'sepia', 'dark', 'black'] as const).map((name) => {
    const t = THEMES[name];
    return {
      value: name,
      label: THEME_LABELS[name],
      preview: (
        <span
          className="flex h-10 w-full items-center justify-center gap-2 rounded-card border"
          style={{
            backgroundColor: t.page,
            color: t.text,
            borderColor: t.line,
          }}
        >
          <span className="font-serif font-bold">Aa</span>
          <span className="block h-2 w-6 rounded-full" style={{ backgroundColor: t.accent }} />
        </span>
      ),
    };
  }),
  { value: 'system', label: THEME_LABELS.system },
];

/**
 * Theme choice for Onboarding and Settings, built on the design system's `ChoiceGroup` (a radio
 * group with arrow keys, Home and End, 44 px targets). The choice is saved at once and applied by
 * ThemeProvider.
 */
export const ThemeSwatches = memo(function ThemeSwatches() {
  const { db } = useServices();
  const preference = useSettings((s) => s.themePreference);
  const setPreference = useSettings((s) => s.setThemePreference);
  const onChange = useCallback((value: ThemePreference) => void setPreference(db, value), [db, setPreference]);
  return <ChoiceGroup label="Theme" variant="tiles" value={preference} options={OPTIONS} onChange={onChange} />;
});
