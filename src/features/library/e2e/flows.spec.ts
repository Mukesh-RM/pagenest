import { expect, test, type Page } from '@playwright/test';
import { makeEpub, makeMp3, makePdf, makeText } from '../../../workers/import/testing/fixtures';
import { cards, consoleErrors } from './support';

const buffer = (bytes: Uint8Array): Buffer => Buffer.from(bytes);

async function pick(page: Page, files: { name: string; mimeType: string; buffer: Buffer }[]): Promise<void> {
  await page.getByRole('button', { name: /^Add$/ }).click();
  await page.getByTestId('pick-files').setInputFiles(files);
}

test('what a file is comes from its content, never its name or type', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your shelf is waiting' })).toBeVisible();
  await pick(page, [
    { name: 'holiday.jpg', mimeType: 'image/jpeg', buffer: buffer(await makeEpub({ title: 'Secret Epub', author: 'N. Ame' })) },
    { name: 'REPORT', mimeType: '', buffer: buffer(makePdf({ title: 'Nameless Pdf', pages: 2 })) },
    { name: 'song.txt', mimeType: 'text/plain', buffer: buffer(makeMp3({ title: 'Quiet Song', frames: 80 })) },
    { name: 'letter.epub', mimeType: 'application/epub+zip', buffer: buffer(Uint8Array.from({ length: 256 }, (_, i) => (i * 7) % 251)) },
    { name: 'photo.png', mimeType: 'image/png', buffer: buffer(makeText('Just some words in a note. '.repeat(20))) },
  ]);
  await expect(page.getByRole('status').filter({ hasText: /Added 4 books/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('status').filter({ hasText: /1 file could not be added/ })).toBeVisible();
  await expect(cards(page)).toHaveCount(4);
  await expect(page.getByRole('main')).toContainText('Secret Epub');
  await expect(page.getByRole('main')).toContainText('Nameless Pdf');
  await expect(page.getByRole('main')).toContainText('Quiet Song');
  // The one that is not a book says why, in plain words, and names the file.
  await page.getByRole('button', { name: 'See why' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('letter.epub');
  await expect(dialog).not.toContainText(/error|exception|undefined|\bat \w+\.\w+\(/i);
  expect(await consoleErrors(page)).toEqual([]);
});

test('the sample book is fetched only when tapped, and opens within 30 s of first launch', async ({ page }) => {
  const epubRequests: string[] = [];
  page.on('request', (request) => {
    if (/\.epub(\?|$)/.test(request.url())) epubRequests.push(request.url());
  });
  const started = Date.now();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your shelf is waiting' })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(epubRequests, 'nothing is downloaded before the person taps').toEqual([]);
  await page.getByRole('button', { name: 'Add the sample book' }).click();
  await expect(page.getByTestId('where')).toHaveText(/^\/(read|listen)\//, { timeout: 25_000 });
  const seconds = (Date.now() - started) / 1000;
  console.log(`PERF first book from first launch via the sample: ${seconds.toFixed(1)} s`);
  expect(seconds).toBeLessThan(30);
  expect(epubRequests).toHaveLength(1);
  expect(new URL(epubRequests[0] as string).origin).toBe(new URL(page.url()).origin);
  const stored = await page.evaluate(async () => {
    const open = indexedDB.open('pagenest');
    const db = await new Promise<IDBDatabase>((resolve) => { open.onsuccess = () => resolve(open.result); });
    const rows = await new Promise<{ title: string; format: string; fingerprint?: string }[]>((resolve) => { const r = db.transaction('books').objectStore('books').getAll(); r.onsuccess = () => resolve(r.result); });
    db.close();
    return rows;
  });
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ title: 'The Tale of Peter Rabbit', format: 'epub' });
  expect(stored[0]?.fingerprint).toBeTruthy();
  expect(await consoleErrors(page)).toEqual([]);
});

test('the 1.5 MB sample is still ready within 30 s on a slow connection (Fast 3G, 4x slower CPU)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your shelf is waiting' })).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  // Chrome's "Fast 3G" preset: 1.6 Mbit/s down, 150 ms round trip.
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const started = Date.now();
  await page.getByRole('button', { name: 'Add the sample book' }).click();
  await expect(page.getByTestId('where')).toHaveText(/^\/(read|listen)\//, { timeout: 29_000 });
  const seconds = (Date.now() - started) / 1000;
  console.log(`PERF sample on Fast 3G + 4x CPU: ${seconds.toFixed(1)} s from the tap to the book opening`);
  expect(seconds).toBeLessThan(30);
});

test('asks the browser to keep the library after the first import, once', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __persistCalls: number };
    w.__persistCalls = 0;
    const storage = navigator.storage;
    storage.persist = async () => {
      w.__persistCalls += 1;
      return true;
    };
    storage.persisted = async () => false;
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your shelf is waiting' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __persistCalls: number }).__persistCalls)).toBe(0);
  await pick(page, [{ name: 'a.epub', mimeType: '', buffer: buffer(await makeEpub({ title: 'First' })) }]);
  await expect(page.getByRole('status').filter({ hasText: /Added 1 book/ })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Dismiss' }).click().catch(() => undefined);
  await pick(page, [{ name: 'b.epub', mimeType: '', buffer: buffer(await makeEpub({ title: 'Second', salt: 'x' })) }]);
  await expect(cards(page)).toHaveCount(2, { timeout: 20_000 });
  expect(await page.evaluate(() => (window as unknown as { __persistCalls: number }).__persistCalls)).toBe(1);
});

test('the library survives a reload and shows no layout shift while it loads', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/');
  await pick(page, [{ name: 'c.epub', mimeType: '', buffer: buffer(await makeEpub({ title: 'Stays Put' })) }]);
  await expect(cards(page)).toHaveCount(1, { timeout: 20_000 });
  await page.reload();
  await expect(cards(page)).toHaveCount(1, { timeout: 10_000 });
  await page.waitForTimeout(800);
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  console.log(`PERF cumulative layout shift after reload: ${cls.toFixed(4)}`);
  expect(cls).toBeLessThan(0.02);
  await expect(page.getByRole('main')).toContainText('Stays Put');
});

test('text at 200% and reduced motion keep the library usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => ((document.documentElement.style.fontSize = '200%'))));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your shelf is waiting' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'no sideways scrolling at 200% text').toBeLessThanOrEqual(1);
  const motion = await page.evaluate(() => {
    const el = document.querySelector('.pn-lib-status, button');
    return el ? getComputedStyle(el).transitionDuration : '0s';
  });
  expect(motion.split(',').every((d) => parseFloat(d) <= 0.01)).toBe(true);
});
