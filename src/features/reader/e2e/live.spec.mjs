// Live reader e2e (owner: Reader). Runs on the production build under the production CSP (see support/server.mjs).
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { bookFrame, openSampleFromFirstLaunch, pagePicture, persistentContext, pictureDiff, savedPosition, settled, waitForBookText, watchErrors } from './support/app.mjs';

const SHOTS = process.env.PN_SHOTS_DIR ?? '/workspace/pn-reader-shots';
const bookIdOf = (page) => new URL(page.url()).pathname.split('/').pop();

test('first launch: two taps to real Peter Rabbit text, under 3 s, no console errors, no silent spinner', async ({ page }, info) => {
  const errors = watchErrors(page);
  const t0 = Date.now();
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip' }).click();
  const tTap1 = Date.now();
  await page.getByRole('button', { name: 'Add the sample book' }).click();
  // While the book opens, anything shown in place of the text must say what is happening.
  const waiting = await page
    .locator('.pn-live__state')
    .first()
    .innerText({ timeout: 300 })
    .catch(() => 'no loading state shown');
  await expect(page).toHaveURL(/\/read\//);
  const text = await waitForBookText(page, { min: 100 });
  const total = Date.now() - t0;
  const fromFirstTap = Date.now() - tTap1;
  console.log(`[${info.project.name}] first launch to text: ${total} ms (from first tap ${fromFirstTap} ms), taps: 2, loading state: ${JSON.stringify(waiting)}`);
  writeFileSync(info.outputPath('first-launch.json'), JSON.stringify({ project: info.project.name, totalMs: total, fromFirstTapMs: fromFirstTap, taps: 2 }));
  expect(text).toMatch(/Peter|Rabbit/i);
  expect(total).toBeLessThan(3000);
  expect(waiting === 'no loading state shown' || waiting.trim().length > 0).toBe(true);
  expect(errors).toEqual([]);
});

test('Aa settings change the page, and a reload comes back to the exact same spot', async ({ page }) => {
  const errors = watchErrors(page);
  await openSampleFromFirstLaunch(page);
  await waitForBookText(page, { min: 100 });
  const id = bookIdOf(page);
  await page.locator('.pn-live__host').focus();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowRight');
    await settled(page, 300);
  }
  const before = await waitForBookText(page, { min: 50 });

  await page.getByRole('button', { name: 'Reading settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reading settings' });
  await dialog.getByRole('radio', { name: /Sepia/ }).click();
  await dialog.getByRole('button', { name: 'Larger text' }).click();
  await dialog.getByRole('button', { name: 'Larger text' }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('.pn-reader')).toHaveAttribute('data-theme', 'sepia');
  const fontSize = await bookFrame(page).evaluate(() => getComputedStyle(document.body).fontSize);
  console.log(`font size in the book after two taps on Larger text: ${fontSize}`);
  expect(parseFloat(fontSize)).toBeGreaterThan(18);
  const picBefore = await pagePicture(page);
  const spotBefore = await savedPosition(page, id);
  expect(spotBefore?.locator?.kind).toBe('reflow');

  await page.reload();
  await waitForBookText(page, { min: 50 });
  await expect(page.locator('.pn-reader')).toHaveAttribute('data-theme', 'sepia');
  const picAfter = await pagePicture(page);
  const spotAfter = await savedPosition(page, id);
  expect(spotAfter?.locator).toEqual(spotBefore.locator);
  expect(await pictureDiff(page, picAfter, picBefore)).toBeLessThan(0.005);
  expect(before.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('closing the app and opening it again returns to the same spot', async ({}, info) => {
  const profile = await persistentContext(info.project.use);
  try {
    let page = await profile.context.newPage();
    await openSampleFromFirstLaunch(page);
    await waitForBookText(page, { min: 100 });
    const id = bookIdOf(page);
    await page.locator('.pn-live__host').focus();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('ArrowRight');
      await settled(page, 300);
    }
    const pic = await pagePicture(page);
    const spot = await savedPosition(page, id);
    await page.close();
    await profile.context.close();

    const again = await persistentContext(info.project.use, profile.dir);
    page = await again.context.newPage();
    await page.goto(`/read/${id}`);
    await waitForBookText(page, { min: 50 });
    expect(await savedPosition(page, id).then((r) => r.locator)).toEqual(spot.locator);
    expect(await pictureDiff(page, await pagePicture(page), pic)).toBeLessThan(0.005);
    await again.context.close();
  } finally {
    profile.cleanup();
  }
});

test('the scrubber moves through the book and the contents sheet jumps to a chapter', async ({ page }) => {
  await openSampleFromFirstLaunch(page);
  await waitForBookText(page, { min: 100 });
  const slider = page.getByRole('slider', { name: 'Position in the book' });
  const start = Number(await slider.inputValue());
  await slider.focus();
  await page.keyboard.press('End');
  await expect.poll(async () => Number(await slider.inputValue()), { timeout: 8000 }).toBeGreaterThan(start);
  await page.getByRole('button', { name: 'Contents' }).click();
  const sheet = page.getByRole('dialog', { name: 'Contents' });
  const chapters = sheet.getByRole('list', { name: 'Chapters' }).getByRole('button');
  await expect(chapters.first()).toBeVisible();
  await chapters.first().click();
  await expect(sheet).toBeHidden();
  await expect.poll(async () => Number(await slider.inputValue()), { timeout: 8000 }).toBeLessThan(200);
});

test('after the first visit the book opens with no network', async ({ page, context }) => {
  await openSampleFromFirstLaunch(page);
  await waitForBookText(page, { min: 100 });
  await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
  await page.reload(); // the reload is controlled by the service worker, which now has every chunk in its cache
  await waitForBookText(page, { min: 100 });
  await context.setOffline(true);
  await page.reload();
  const text = await waitForBookText(page, { min: 100 });
  expect(text).toMatch(/Peter|Rabbit/i);
});

for (const width of [360, 430]) {
  for (const theme of ['Light', 'Dark', 'Sepia', 'Black']) {
    test(`screenshot ${width} ${theme}`, async ({ browser }, info) => {
      test.skip(info.project.name !== 'laptop', 'one device project takes the screenshots, at explicit widths');
      mkdirSync(SHOTS, { recursive: true });
      const context = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2, baseURL: info.project.use.baseURL });
      const page = await context.newPage();
      const errors = watchErrors(page);
      await openSampleFromFirstLaunch(page);
      await waitForBookText(page, { min: 100 });
      await page.getByRole('button', { name: 'Reading settings' }).click();
      const dialog = page.getByRole('dialog', { name: 'Reading settings' });
      await dialog.getByRole('radio', { name: new RegExp(theme) }).click();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await page.locator('.pn-live__host').focus();
      // Go to where the story starts ("Once upon a time there were four little Rabbits") through the engine's own API.
      await page.evaluate(async () => {
        const renderer = document.querySelector('foliate-view').renderer;
        const { index, doc } = renderer.getContents()[0];
        const node = Array.from(doc.body.querySelectorAll('*')).flatMap((el) => Array.from(el.childNodes)).find((n) => n.nodeType === 3 && n.data.includes('Once upon a time'));
        const range = doc.createRange();
        range.setStart(node, node.data.indexOf('Once upon a time'));
        range.setEnd(node, node.data.indexOf('Once upon a time') + 4);
        await renderer.goTo({ index, anchor: range });
      });
      await settled(page, 600);
      await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 500 }).catch(() => undefined);
      await page.waitForTimeout(400);
      const text = await waitForBookText(page, { min: 100 });
      expect(text.length).toBeGreaterThan(100);
      await page.screenshot({ path: `${SHOTS}/peter-rabbit-${width}-${theme.toLowerCase()}.png` });
      expect(errors).toEqual([]);
      await context.close();
    });
  }
}
