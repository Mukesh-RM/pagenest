import { expect, test, type Page } from '@playwright/test';
import {
  makeCbz, makeDocx, makeEpub, makeFb2, makeMobi, makeMp3, makePdf, makeText, makeMp4Audio,
} from '../../../workers/import/testing/fixtures';
import { consoleErrors, recordLongTasks, throttleCpu } from './support';

type Payload = { name: string; mimeType: string; buffer: Buffer };
const payload = (name: string, mimeType: string, bytes: Uint8Array): Payload => ({ name, mimeType, buffer: Buffer.from(bytes) });

async function openAddSheet(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Add books' }).first().click();
  await expect(page.getByTestId('pick-files')).toBeAttached();
}

test('500 mixed files import without a main-thread task of 50 ms or more', async ({ page }) => {
  test.setTimeout(240_000);
  // 500 different files of every supported kind. Names and types are deliberately unhelpful for some of them.
  const files: Payload[] = [];
  const kinds = ['epub', 'pdf', 'mp3', 'docx', 'txt', 'cbz', 'fb2', 'mobi', 'm4b', 'mp3b'] as const;
  for (let i = 0; i < 500; i += 1) {
    const kind = kinds[i % kinds.length] as (typeof kinds)[number];
    const title = `Mixed ${kind} ${i}`;
    const salt = `s${i}`;
    switch (kind) {
      case 'epub': files.push(payload(`book-${i}.epub`, 'application/epub+zip', await makeEpub({ title, author: `Author ${i % 9}`, salt }))); break;
      case 'pdf': files.push(payload(`scan ${i}`, '', makePdf({ title, pages: 3, salt }))); break; // no extension
      case 'mp3': files.push(payload(`track-${i}.dat`, 'application/octet-stream', makeMp3({ title, artist: `Artist ${i % 5}`, frames: 120 + i }))); break; // wrong extension
      case 'docx': files.push(payload(`letter-${i}.zip`, 'application/zip', await makeDocx({ title, salt }))); break;
      case 'txt': files.push(payload(`notes-${i}.pdf`, 'application/pdf', makeText(`${title}\n\nA quiet paragraph number ${i}. `))); break; // text called .pdf
      case 'cbz': files.push(payload(`comic-${i}`, 'image/jpeg', await makeCbz({ pages: 3, salt: i }))); break;
      case 'fb2': files.push(payload(`story-${i}.xml`, 'text/xml', makeFb2({ title, salt }))); break;
      case 'mobi': files.push(payload(`old-${i}.bin`, '', makeMobi({ title }))); break;
      case 'm4b': files.push(payload(`talk-${i}.mp3`, 'audio/mpeg', makeMp4Audio({ brand: 'M4B ', title, album: title, seconds: 5 + i }))); break;
      case 'mp3b': files.push(payload(`sound-${i}.txt`, 'text/plain', makeMp3({ title, id3: false, frames: 90 + i }))); break; // audio called .txt
    }
  }
  await recordLongTasks(page);
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  await throttleCpu(page, 4);
  await openAddSheet(page);
  // Playwright hands 500 files to the page in one go; that transfer is the test harness, not the app, so
  // only tasks that begin after the page received the files are counted (the `change` event runs in the app's code).
  await page.evaluate(() => document.addEventListener('change', () => ((window as unknown as { __changeAt: number }).__changeAt = performance.now()), true));
  const began = Date.now();
  await page.getByTestId('pick-files').setInputFiles(files);
  const status = page.getByRole('status').filter({ hasText: /added|adding|Adding/i });
  await expect(status.first()).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => page.evaluate(async () => {
    const open = indexedDB.open('pagenest');
    const db = await new Promise<IDBDatabase>((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
    const n = await new Promise<number>((resolve) => { const r = db.transaction('books').objectStore('books').count(); r.onsuccess = () => resolve(r.result); });
    db.close();
    return n;
  }), { timeout: 200_000, intervals: [500] }).toBeGreaterThanOrEqual(480);
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden({ timeout: 100_000 });
  // Long tasks that began after the page received the files. (The one task that began before is the
  // browser being handed 500 files by the test driver, which is not the app.)
  const { at, log } = await page.evaluate(() => ({
    at: (window as unknown as { __changeAt: number }).__changeAt,
    log: (window as unknown as { __longLog: [number, number][] }).__longLog,
  }));
  const before = log.filter(([start]) => start < at);
  const tasks = log.filter(([start]) => start >= at).map(([, duration]) => duration);
  expect(before.length).toBeLessThanOrEqual(1);
  const count = await page.evaluate(async () => {
    const open = indexedDB.open('pagenest');
    const db = await new Promise<IDBDatabase>((resolve) => { open.onsuccess = () => resolve(open.result); });
    const n = await new Promise<number>((resolve) => { const r = db.transaction('books').objectStore('books').count(); r.onsuccess = () => resolve(r.result); });
    db.close();
    return n;
  });
  console.log(`PERF import 500 mixed files (4x CPU slowdown): ${count} books stored in ${Math.round((Date.now() - began) / 1000)} s, longest main-thread task ${Math.round(Math.max(0, ...tasks))} ms, long tasks ${JSON.stringify(tasks.map(Math.round))}`);
  expect(count).toBe(500);
  expect(Math.max(0, ...tasks)).toBeLessThan(50);
  expect(await consoleErrors(page)).toEqual([]);
});
