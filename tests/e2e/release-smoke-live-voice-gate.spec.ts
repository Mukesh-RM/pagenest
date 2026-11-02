import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { dismissLibraryOverlays, gotoTab, primeSmokeHints, skipOnboarding, waitForIndexedDbReady } from './support/app';
import { attachReleaseSmokeConsoleGuard } from './support/release-smoke-console';
import { openReadAloudControls } from './support/narration-live';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const live = process.env.PAGENEST_SMOKE_LIVE === '1';
const host = process.env.PAGENEST_SMOKE_LIVE_HOST ?? 'live';
const shotDir = join(repoRoot, 'docs/screens/release-smoke-live', host);
const VIEW = { width: 360, height: 740 };

async function snap(page: Page, project: string, name: string): Promise<void> {
  mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: join(shotDir, `${project}-voice-gate-${name}.png`), fullPage: true });
}

test.describe('live voice clone gates (production build)', () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    test.skip(!live, 'Set PAGENEST_SMOKE_LIVE=1 (npm run smoke:live).');
    test.skip(!['release-smoke-chromium', 'release-smoke-webkit'].includes(testInfo.project.name));
    await primeSmokeHints(context);
    await page.setViewportSize(VIEW);
  });

  test('Voice Studio has no Train on device; read-aloud has no My voice', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const project = testInfo.project.name;
    const consoleErrors: string[] = [];
    attachReleaseSmokeConsoleGuard(page, consoleErrors);

    await page.goto('./');
    await skipOnboarding(page);
    await dismissLibraryOverlays(page);
    await waitForIndexedDbReady(page);

    await gotoTab(page, 'Settings');
    await page.locator('#pn-set-voices').scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: 'Voice Studio' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Train on device' })).toHaveCount(0);
    await snap(page, project, '01-voice-studio');

    await gotoTab(page, 'Library');
    await page.getByRole('region', { name: /try a sample book/i }).getByRole('button', { name: /add the sample book/i }).click({ timeout: 20_000 });
    await page.waitForURL(/\/read\//, { timeout: 60_000 }).catch(async () => {
      await page.locator('main li, main [role=listitem]').first().click();
      await page.waitForURL(/\/read\//, { timeout: 60_000 });
    });
    await openReadAloudControls(page);
    await page.getByRole('button', { name: 'Choose voice' }).click();
    await expect(page.getByRole('button', { name: /My voice/i })).toHaveCount(0);
    await snap(page, project, '02-narration-voices');

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  });
});
