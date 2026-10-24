// Exact resume: read somewhere, kill the app, reopen, and land on the same spot (PDF and EPUB).
import { expect, test } from '@playwright/test';
import { BOOKS } from './support/fixtures.mjs';
import { openReader, persistentContext, readingSpot, savedPosition, seedBook, settled, watchErrors } from './support/app.mjs';

const KINDS = [
  {
    name: 'EPUB',
    book: BOOKS.epub,
    async readSomewhere(page) {
      await page.getByRole('button', { name: /^Contents/ }).click();
      await page.locator('.pn-list__row').nth(6).click(); // a chapter in the middle
      await page.locator('.pn-sheet-root[data-state="closed"]').waitFor({ state: 'attached' });
      await page.waitForTimeout(800);
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(500);
      }
    },
  },
  {
    name: 'PDF',
    book: BOOKS.pdf,
    async readSomewhere(page) {
      await page.getByRole('slider', { name: 'Position in the book' }).focus();
      await page.keyboard.press('Escape'); // chrome off, focus back on the page
      await page.locator('.pn-pdf').focus();
      await page.evaluate(() => {
        const s = document.querySelector('.pn-pdf');
        s.scrollTop = s.scrollHeight * 0.37;
      });
      await page.waitForTimeout(800);
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(800);
    },
  },
];

for (const kind of KINDS) {
  for (const how of ['crash', 'close']) {
    test(`${kind.name} reopens at the exact spot after the app is ${how === 'crash' ? 'killed (renderer crash)' : 'closed'}`, async ({}, testInfo) => {
      const first = await persistentContext({ ...testInfo.project.use });
      let spot;
      let id;
      try {
        const page = await first.context.newPage();
        const errors = watchErrors(page);
        id = await seedBook(page, kind.book);
        await openReader(page, id);
        await kind.readSomewhere(page);
        spot = await readingSpot(page);
        if (how === 'crash') {
          // The service saves 5 seconds after the last move. Wait for it, then kill the renderer without any unload event.
          await expect.poll(async () => (await savedPosition(page, id))?.updatedAt ?? 0, { timeout: 12000, intervals: [500] }).toBeGreaterThan(0);
          await page.waitForTimeout(500);
          await page.goto('chrome://crash').catch(() => undefined);
          await page.waitForTimeout(500);
        } else {
          await page.close({ runBeforeUnload: true });
        }
        expect(errors).toEqual([]);
      } finally {
        await first.context.close();
      }

      const second = await persistentContext({ ...testInfo.project.use }, first.dir);
      try {
        const page = await second.context.newPage();
        const errors = watchErrors(page);
        await openReader(page, id);
        await expect(page.locator('.pn-welcome')).toContainText(/Welcome back, (chapter \d+|page \d+)/);
        const after = await readingSpot(page);
        expect(after.position).toBe(spot.position);
        expect(after.chapter).toBe(spot.chapter);
        expect(Buffer.compare(after.picture, spot.picture) === 0, 'the page picture is identical to before the kill').toBe(true);
        expect(errors).toEqual([]);
      } finally {
        await second.context.close();
        first.cleanup();
      }
    });
  }
}

test('resume is exact for the book that was seeded last, even with several books', async ({}, testInfo) => {
  const { context, cleanup } = await persistentContext({ ...testInfo.project.use });
  try {
    const page = await context.newPage();
    const a = await seedBook(page, BOOKS.epub);
    const b = await seedBook(page, BOOKS.pdf);
    await openReader(page, a);
    await page.keyboard.press('ArrowRight');
    await settled(page);
    await openReader(page, b);
    await page.waitForTimeout(300);
    expect(await savedPosition(page, b)).toBeNull();
    expect((await savedPosition(page, a))?.locator.kind).toBe('reflow');
  } finally {
    await context.close();
    cleanup();
  }
});
