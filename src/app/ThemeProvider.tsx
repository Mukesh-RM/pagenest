import { useCallback, useEffect, type ReactNode } from 'react';
import { ThemeProvider as DesignThemeProvider } from '@/ui/theme/ThemeProvider';
import { applyFontSize } from './apply-theme';
import { useServices } from './services-context';
import { useSettings } from './settings-store';

/**
 * Loads saved settings, then applies them: the design system's `ThemeProvider`
 * writes `data-theme` on `<html>` (colors come from `src/ui/styles/tokens.css`,
 * "Match my phone" follows the device), and the text size is written to the
 * `--pn-font-size` and `--pn-text-*` variables. Changes are saved by the settings store.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { db } = useServices();
  const preference = useSettings((s) => s.themePreference);
  const customTheme = useSettings((s) => s.customTheme);
  const fontSizePx = useSettings((s) => s.fontSizePx);
  const load = useSettings((s) => s.load);
  const setPreference = useSettings((s) => s.setThemePreference);

  useEffect(() => {
    void load(db);
  }, [db, load]);

  useEffect(() => {
    applyFontSize(fontSizePx);
  }, [fontSizePx]);

  const onModeChange = useCallback((mode: typeof preference) => void setPreference(db, mode), [db, setPreference]);

  return (
    <DesignThemeProvider mode={preference} customTheme={customTheme} onModeChange={onModeChange}>
      {children}
    </DesignThemeProvider>
  );
}
