import type { Page } from '@playwright/test';
import { isChunkLoadError } from '../../../src/app/chunk-import';

/** Page errors that do not indicate a broken reader on WebKit / live smoke. */
export function isBenignReleaseSmokePageError(message: string): boolean {
  if (/Unable to preload CSS for \/assets\/[^ ]+\.css/i.test(message)) return true;
  if (/access control checks/i.test(message)) return true;
  // Production live smoke may log a stale-chunk import once while the app retries or reloads (see chunk-import.ts).
  if (process.env.PAGENEST_SMOKE_LIVE === '1' && isChunkLoadError(new Error(message))) return true;
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
