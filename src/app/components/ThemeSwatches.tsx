import { memo, useCallback } from 'react';
import { ThemePicker } from '@/ui/components/ThemePicker';
import type { CustomThemeInput } from '@/ui/theme/custom';
import { useServices } from '../services-context';
import { useSettings } from '../settings-store';
import type { ThemePreference } from '../themes';

/**
 * Theme choice for Onboarding and Settings: the design system's `ThemePicker` (Light, Sepia, Dark,
 * Black, Custom with its three color fields, and "Match my phone"). Choices are saved at once and
 * applied by `ThemeProvider`.
 */
export const ThemeSwatches = memo(function ThemeSwatches() {
  const { db } = useServices();
  const preference = useSettings((s) => s.themePreference);
  const customTheme = useSettings((s) => s.customTheme);
  const setPreference = useSettings((s) => s.setThemePreference);
  const setCustomTheme = useSettings((s) => s.setCustomTheme);
  const onChange = useCallback((value: ThemePreference) => void setPreference(db, value), [db, setPreference]);
  const onCustomChange = useCallback((colors: CustomThemeInput) => void setCustomTheme(db, colors), [db, setCustomTheme]);
  return <ThemePicker value={preference} onChange={onChange} custom={customTheme} onCustomChange={onCustomChange} />;
});
