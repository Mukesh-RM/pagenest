const KEY = 'pn.hasResume';

/**
 * Remember (in localStorage, a synchronous read) whether the last visit showed the "Welcome back"
 * card, so the next launch can reserve exactly that space while the database is still being read.
 * The database stays the source of truth; this only prevents the page from jumping.
 */
export function hadResumeCard(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberResumeCard(shown: boolean): void {
  try {
    if (shown) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the card just may shift once on the next launch.
  }
}
