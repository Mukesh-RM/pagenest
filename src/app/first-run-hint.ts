const KEY = 'pn.onboarded';

/**
 * Remember (in localStorage, a synchronous read) that this device finished onboarding once. The very
 * first lines of the app use it to start downloading the right first screen (the Library for a returning
 * person, onboarding for a new one) before IndexedDB has answered, and to show onboarding straight
 * away on a first launch. The database stays the source of truth: when it disagrees, it wins.
 */
export function isReturningDevice(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberOnboarded(done: boolean): void {
  try {
    if (done) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the first screen is just not started early on the next launch.
  }
}
