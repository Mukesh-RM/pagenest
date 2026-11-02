import type { Page } from '@playwright/test';

/** Page errors that do not indicate a broken reader on WebKit / live smoke. */
export function isBenignReleaseSmokePageError(message: string): boolean {
  if (/Unable to preload CSS for \/assets\/[^ ]+\.css/i.test(message)) return true;
  if (/access control checks/i.test(message)) return true;
  // WebKit + live SW: a lazy chunk can log this while the reader still opens (upgrade persistent profile).
  if (process.env.PAGENEST_SMOKE_LIVE === '1' && /Importing a module script failed/i.test(message)) return true;
  return false;
}

export function attachReleaseSmokeConsoleGuard(page: Page, errors: string[]): void {
  page.on('pageerror', (e) => {
    if (isBenignReleaseSmokePageError(e.message)) return;
    errors.push(`pageerror: ${e.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (isBenignReleaseSmokePageError(text)) return;
    errors.push(`console: ${text}`);
  });
}
