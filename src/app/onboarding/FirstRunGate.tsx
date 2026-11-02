import { useEffect, useRef, type ReactNode } from 'react';
import { preloadScreens } from '../screens';
import { isReturningDevice } from '../first-run-hint';
import { useSettings } from '../settings-store';

/**
 * Shows `onboarding` on first run and the app afterwards. While settings load, returning devices see a
 * busy shell; brand-new devices may show onboarding immediately (before IndexedDB answers).
 */
export function FirstRunGate({ children, onboarding }: { children: ReactNode; onboarding: ReactNode }) {
  const loaded = useSettings((s) => s.loaded);
  const done = useSettings((s) => s.onboardingDone);
  const wasOnboarding = useRef(false);

  useEffect(() => {
    if (loaded && done) preloadScreens(['collections', 'stats', 'settings']);
  }, [loaded, done]);

  useEffect(() => {
    if (loaded && !done) wasOnboarding.current = true;
    if (!(loaded && done && wasOnboarding.current)) return;
    wasOnboarding.current = false;
    // Design system screens render a plain h1; make it focusable (not tabbable) so focus can land on it. The
    // new screen may still be loading (its chunk, its first read), so wait for the heading for a moment.
    const focusHeading = (): boolean => {
      const heading = document.querySelector<HTMLElement>('main h1');
      if (!heading) return false;
      if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
      heading.focus();
      return true;
    };
    if (focusHeading()) return;
    const observer = new MutationObserver(() => {
      if (focusHeading()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const giveUp = window.setTimeout(() => observer.disconnect(), 5000);
    return () => {
      observer.disconnect();
      window.clearTimeout(giveUp);
    };
  }, [loaded, done]);

  if (!loaded) {
    if (!isReturningDevice()) {
      wasOnboarding.current = true;
      return <>{onboarding}</>;
    }
    return <div aria-busy="true" className="h-full" />;
  }
  if (!done) {
    wasOnboarding.current = true;
    return <>{onboarding}</>;
  }
  return <>{children}</>;
}
