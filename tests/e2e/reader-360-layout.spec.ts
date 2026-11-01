import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchFresh, skipOnboarding } from './support/app';
import { waitForFoliateBookText, dismissReaderInterstitials } from './support/foliate-reader';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const VIEW = { width: 360, height: 740 };

function readFixture(path: string): Buffer {
  return readFileSync(join(repoRoot, path));
}

async function importEpub(page: Page, buffer: Buffer, name = 'alice.epub'): Promise<void> {
  await page.goto('/');
  await skipOnboarding(page);
  await page.getByRole('button', { name: 'Add books' }).first().click();
  await page.getByTestId('pick-files').setInputFiles({ name, mimeType: 'application/epub+zip', buffer });
  await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 5000 }).catch(() => undefined);
  const card = page.getByRole('button', { name: /Alice|Wonderland/i }).first();
  await expect(card).toBeVisible({ timeout: 60_000 });
  if (page.url().includes('/read/')) {
    await dismissReaderInterstitials(page);
    return;
  }
  const start = page.getByRole('dialog').getByRole('button', { name: /^(read|continue|open|start)/i }).first();
  if (!(await start.isVisible().catch(() => false))) {
    await card.click();
  }
  if (!(page.url().includes('/read/'))) {
    await start.click({ timeout: 15_000 });
  }
  await expect(page).toHaveURL(/\/read\//, { timeout: 90_000 });
  await dismissReaderInterstitials(page);
}

async function assertNoOverlap(page: Page, selectors: string[]): Promise<void> {
  const pairs = await page.evaluate((sels) => {
    const rects = sels
      .map((sel) => {
        const el = document.querySelector(sel);
        const r = el?.getBoundingClientRect();
        return r && r.width > 4 && r.height > 4 ? { sel, x: r.left, y: r.top, w: r.width, h: r.height } : undefined;
      })
      .filter(Boolean) as Array<{ sel: string; x: number; y: number; w: number; h: number }>;
    const overlaps: string[] = [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlapW = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapH = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (overlapW > 8 && overlapH > 8) overlaps.push(`${a.sel} × ${b.sel}`);
      }
    }
    return overlaps;
  }, selectors);
  expect(pairs, `overlapping controls: ${pairs.join(', ')}`).toEqual([]);
}

test.describe('reader at 360px', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEW);
  });

  test('EPUB shows book text; narration is collapsed; header tools do not overlap', async ({ page }) => {
    await launchFresh(page);
    const buffer = readFixture('src/features/reader/fixtures/alice.epub');
    await importEpub(page, buffer);
    const text = await waitForFoliateBookText(page, { min: 200, needle: 'Alice', timeout: 120_000 });
    expect(text.length).toBeGreaterThan(200);
    await expect(page.getByRole('region', { name: 'Read aloud controls' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Read aloud' })).toBeVisible();
    await assertNoOverlap(page, [
      'button[aria-label="Search in this book"]',
      'button[aria-label="Add bookmark here"]',
      'button[aria-label="Bookmarks and highlights"]',
      'button[aria-label="Reading settings"]',
      '.pn-narration-dock__toggle',
    ]);
    await page.getByRole('button', { name: 'Read aloud' }).click();
    await expect(page.getByRole('dialog', { name: 'Read aloud' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Read aloud controls' })).toBeVisible();
  });

  test('200% text: reader chrome still fits without overlap', async ({ page }) => {
    await launchFresh(page);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    const buffer = readFixture('src/features/reader/fixtures/alice-illustrated.epub');
    await importEpub(page, buffer, 'alice-illustrated.epub');
    await waitForFoliateBookText(page, { min: 100, timeout: 120_000 });
    await assertNoOverlap(page, [
      'button[aria-label="Search in this book"]',
      'button[aria-label="Add bookmark here"]',
      'button[aria-label="Reading settings"]',
      '.pn-narration-dock__toggle',
    ]);
  });
});
