import { useEffect, useRef, type ReactNode } from 'react';
import { useSettings } from '../settings-store';

/**
 * Shows `onboarding` (a lazily loaded screen) on first run and the app afterwards. While saved settings
 * are still loading it shows an empty themed page, so returning users never
 * see onboarding flash by. When onboarding ends, focus moves to the new screen's heading.
 */
export function FirstRunGate({ children, onboarding }: { children: ReactNode; onboarding: ReactNode }) {
  const loaded = useSettings((s) => s.loaded);
  const done = useSettings((s) => s.onboardingDone);
  const wasOnboarding = useRef(false);

  useEffect(() => {
    if (loaded && !done) wasOnboarding.current = true;
    if (loaded && done && wasOnboarding.current) {
      wasOnboarding.current = false;
      document.querySelector<HTMLElement>('main h1')?.focus();
    }
  }, [loaded, done]);

  if (!loaded) return <div aria-busy="true" className="h-full" />;
  if (!done) return <>{onboarding}</>;
  return <>{children}</>;
}
