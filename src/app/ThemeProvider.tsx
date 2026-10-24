import { useEffect, type ReactNode } from 'react';
import { useServices } from './services-context';
import { useSettings } from './settings-store';
import { applyTheme } from './apply-theme';
import { resolveTheme } from './themes';

/**
 * Loads saved settings, then keeps `<html>` in sync with the chosen theme,
 * following the device's dark-mode setting when the choice is "Match my phone".
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { db } = useServices();
  const preference = useSettings((s) => s.themePreference);
  const load = useSettings((s) => s.load);

  useEffect(() => {
    void load(db);
  }, [db, load]);

  useEffect(() => {
    const query = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : undefined;
    const update = (): void => applyTheme(resolveTheme(preference, query?.matches ?? false));
    update();
    if (preference !== 'system' || !query) return;
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [preference]);

  return <>{children}</>;
}
