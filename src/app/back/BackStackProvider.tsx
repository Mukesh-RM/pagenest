import { useEffect, useState, type ReactNode } from 'react';
import { BackStack } from './back-stack';
import { BackStackContext } from './back-context';

/**
 * Provides the one {@link BackStack} for the app and listens for the back
 * gesture. Place it inside the router, above every screen that can open a
 * sheet. Pass `stack` in tests.
 */
export function BackStackProvider({ stack, children }: { stack?: BackStack; children: ReactNode }) {
  const [owned] = useState(() => stack ?? new BackStack());
  const active = stack ?? owned;
  useEffect(() => active.attach(), [active]);
  return <BackStackContext.Provider value={active}>{children}</BackStackContext.Provider>;
}
