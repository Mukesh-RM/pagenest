import { expect, test } from '@playwright/test';
import { describeShifts, readCls, recordLayoutShift } from './support/layout';

// (The late change comes after the first paint: Chrome does not count shifts before it.)
// Harness self-check for the CLS gates: a page that shifts MUST measure over the limit and name the element that moved;
// a stable page must measure ~0. Chromium only (layout-shift entries).
test.describe('CLS harness', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'layout-shift is Chromium only');
  const page_ = (late: boolean) => `data:text/html,${encodeURIComponent(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:16px sans-serif}.card{margin:0;padding:16px;background:#eee;min-height:45vh;border-bottom:1px solid #999}.banner{height:30vh;background:#fc0}</style>
<div id="top"></div><section class="card">Welcome back: The Long Road Back</section><section class="card">Library list</section>
<script>${late ? "setTimeout(()=>{document.getElementById('top').innerHTML='<div class=banner>Resume</div>'},1500)" : ''}</script>`)}`;

  test('a late banner that pushes the page down fails the limit and is named', async ({ page }) => {
    await recordLayoutShift(page);
    await page.goto(page_(true));
    await page.waitForTimeout(2500);
    const { cls, shifts } = await readCls(page);
    expect(cls, describeShifts(shifts)).toBeGreaterThan(0.1);
    expect(describeShifts(shifts)).toMatch(/section\.card/);
  });

  test('a stable page measures about zero', async ({ page }) => {
    await recordLayoutShift(page);
    await page.goto(page_(false));
    await page.waitForTimeout(2500);
    expect((await readCls(page)).cls).toBeLessThan(0.01);
  });
});
