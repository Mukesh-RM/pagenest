import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSampleFromFirstLaunch, settled, waitForBookText, watchErrors } from './support/app.mjs';

const defaultDir = resolve(dirname(fileURLToPath(import.meta.url)), 'shots');
const SHOTS = process.env.PN_SHOTS_DIR ?? defaultDir;

for (const width of [360, 430]) {
  for (const theme of ['Light', 'Dark', 'Sepia', 'Black']) {
    test(`phase2 screenshot ${width} ${theme}`, async ({ browser }, info) => {
      test.skip(info.project.name !== 'laptop', 'screenshots at explicit widths from one project');
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
      await settled(page, 400);
      const path = `${SHOTS}/peter-rabbit-${width}-${theme.toLowerCase()}.png`;
      await page.screenshot({ path });
      expect(errors).toEqual([]);
      await context.close();
      console.log(`saved ${path}`);
    });
  }
}
