import { expect, test, type Page } from '@playwright/test';
import { TABS, installHelpButton, gotoTab, launch, sheet, tab, type TabName } from '../e2e/support/app';
import { longTasks, measureInput, percentile, recordLongTasks, throttleCpu } from '../e2e/support/perf';
import { BUDGETS } from './budgets';

// Blueprint 3: "Every action responds within 100 ms". Measured from pointerdown to the first painted frame that shows the
// change, on the Chromium mobile profile with the CPU slowed down to a mid-range phone (see budgets.ts).

test.beforeEach(async ({ page }) => {
  await recordLongTasks(page);
  await throttleCpu(page, BUDGETS.tap.cpuThrottle);
});

function report(name: string, samples: number[]): string {
  const sorted = [...samples].sort((a, b) => a - b);
  return `${name}: n=${samples.length} min=${sorted[0]!.toFixed(0)} p50=${percentile(samples, 50).toFixed(0)} p95=${percentile(samples, 95).toFixed(0)} max=${sorted.at(-1)!.toFixed(0)} ms (budget p95 ${BUDGETS.tap.p95Ms} ms)`;
}

async function tapCurrent(page: Page, name: TabName): Promise<number> {
  const label = JSON.stringify(name);
  return measureInput(
    page,
    `(document.querySelector('h1')?.textContent ?? '').trim() === ${label} && [...document.querySelectorAll('nav a[aria-current="page"]')].some((a) => (a.textContent ?? '').trim() === ${label})`,
    () => tab(page, name).tap(),
  );
}

test('tapping a tab shows the new screen within the tap budget (p95)', async ({ page }, testInfo) => {
  await launch(page);
  const samples: number[] = [];
  for (let i = 0; i < BUDGETS.tap.samples; i++) samples.push(await tapCurrent(page, TABS[(i + 1) % TABS.length]!));
  const line = report('tab tap', samples);
  console.log(line);
  await testInfo.attach('tap-tab.txt', { body: line, contentType: 'text/plain' });
  expect(percentile(samples, 95), line).toBeLessThanOrEqual(BUDGETS.tap.p95Ms);
});

test('choosing a theme repaints the app within the tap budget (p95)', async ({ page }, testInfo) => {
  await launch(page);
  await gotoTab(page, 'Settings');
  const samples: number[] = [];
  const themes = ['Dark', 'Light', 'Black', 'Light'] as const;
  for (let i = 0; i < BUDGETS.tap.samples; i++) {
    const name = themes[i % themes.length]!;
    samples.push(await measureInput(
      page,
      `document.documentElement.dataset.theme === ${JSON.stringify(name.toLowerCase())}`,
      () => page.getByRole('radio', { name: new RegExp(`^${name}$`, 'i') }).tap(),
    ));
  }
  const line = report('theme tap', samples);
  console.log(line);
  await testInfo.attach('tap-theme.txt', { body: line, contentType: 'text/plain' });
  expect(percentile(samples, 95), line).toBeLessThanOrEqual(BUDGETS.tap.p95Ms);
});

test('opening the Install help bottom sheet is within the tap budget (p95)', async ({ page }, testInfo) => {
  await launch(page);
  await gotoTab(page, 'Settings');
  const samples: number[] = [];
  for (let i = 0; i < 10; i++) {
    samples.push(await measureInput(page, `!!document.querySelector('[role="dialog"]')`, () => installHelpButton(page).tap()));
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
  }
  const line = report('sheet open', samples);
  console.log(line);
  await testInfo.attach('tap-sheet.txt', { body: line, contentType: 'text/plain' });
  expect(percentile(samples, 95), line).toBeLessThanOrEqual(BUDGETS.tap.p95Ms);
});

test('no long task blocks the main thread while using the tabs', async ({ page }) => {
  await launch(page);
  for (let i = 0; i < 12; i++) await tapCurrent(page, TABS[(i + 1) % TABS.length]!);
  const tasks = await longTasks(page);
  const worst = Math.max(0, ...tasks);
  expect(worst, `long tasks (ms): ${JSON.stringify(tasks.map(Math.round))}`).toBeLessThanOrEqual(BUDGETS.jank.maxLongTaskMs);
});
