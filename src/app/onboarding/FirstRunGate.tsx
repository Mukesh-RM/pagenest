import { useEffect, useRef, type ReactNode } from 'react';
import { useSettings } from '../settings-store';
import { Onboarding } from './Onboarding';

/**
 * Shows onboarding on first run and the app afterwards. While saved settings
 * are still loading it shows an empty themed page, so returning users never
 * see onboarding flash by. When onboarding ends, focus moves to the main area.
 */
export function FirstRunGate({ children }: { children: ReactNode }) {
  const loaded = useSettings((s) => s.loaded);
  const done = useSettings((s) => s.onboardingDone);
  const wasOnboarding = useRef(false);

  useEffect(() => {
    if (loaded && !done) wasOnboarding.current = true;
    if (loaded && done && wasOnboarding.current) {
      wasOnboarding.current = false;
      document.getElementById('main')?.focus();
    }
  }, [loaded, done]);

  if (!loaded) return <div aria-busy="true" className="h-full" />;
  if (!done) return <Onboarding />;
  return <>{children}</>;
}
