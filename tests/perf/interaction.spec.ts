import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { TABS, installHelpButton, gotoTab, launch, sheet, tab, themeOption, type TabName } from '../e2e/support/app';
import { longTasks, machineLoadPerCore, measureInput, percentile, recordLongTasks, throttleCpu } from '../e2e/support/perf';
import { BUDGETS } from './budgets';

// Blueprint 3: "Every action responds within 100 ms". Measured from pointerdown to the first painted frame that shows the
// change, on the Chromium mobile profile with the CPU slowed down to a mid-range phone (see budgets.ts).

test.beforeEach(async ({ page }) => {
  // Mutation switch to prove the gate has teeth: PAGENEST_QA_SLOW_TAP_MS=150 makes every pointerdown block the main thread
  // for that long, like a slow handler would. The tap gates must then FAIL, quiet machine or not.
  const slow = Number(process.env.PAGENEST_QA_SLOW_TAP_MS ?? 0);
  if (slow > 0) await page.addInitScript((ms) => { addEventListener('pointerdown', () => { const t = performance.now(); while (performance.now() - t < ms); }, true); }, slow);
  await recordLongTasks(page);
  await throttleCpu(page, BUDGETS.tap.cpuThrottle);
});

function report(name: string, samples: number[]): string {
  const sorted = [...samples].sort((a, b) => a - b);
  return `${name}: n=${samples.length} min=${sorted[0]!.toFixed(0)} p50=${percentile(samples, 50).toFixed(0)} p95=${percentile(samples, 95).toFixed(0)} max=${sorted.at(-1)!.toFixed(0)} ms (budget p95 ${BUDGETS.tap.p95Ms} ms)`;
}

/**
 * The tap gate. `collect(n)` takes n taps and returns their latencies. The first `warmup` are discarded and p95 is taken over
 * the next `samples`. If p95 is over budget AND the machine was busy (load per core above `busyLoadPerCore`, measured before and
 * after), the gate measures once more after a pause, because a loaded box delays input dispatch and frames for reasons that
 * are not the app's. A failure on a quiet machine, or a second failure, fails the gate. The 100 ms threshold is never relaxed.
 */
async function tapGate(page: Page, testInfo: TestInfo, name: string, collect: (n: number) => Promise<number[]>): Promise<void> {
  const lines: string[] = [];
  let p95 = Number.NaN;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const before = machineLoadPerCore();
    const all = await collect(BUDGETS.tap.warmup + BUDGETS.tap.samples);
    const load = Math.max(before, machineLoadPerCore());
    const samples = all.slice(BUDGETS.tap.warmup);
    p95 = percentile(samples, 95);
    const line = `${report(name, samples)} load/core=${load.toFixed(2)}${attempt === 2 ? ' (second measurement)' : ''}`;
    lines.push(line);
    console.log(line);
    if (p95 <= BUDGETS.tap.p95Ms || load < BUDGETS.tap.busyLoadPerCore) break;
    lines.push(`over budget while the machine was busy (load/core ${load.toFixed(2)} >= ${BUDGETS.tap.busyLoadPerCore}): measuring once more`);
    await page.waitForTimeout(3000);
  }
  await testInfo.attach(`tap-${name.replace(/\s+/g, '-')}.txt`, { body: lines.join('\n'), contentType: 'text/plain' });
  expect(p95, lines.join('\n')).toBeLessThanOrEqual(BUDGETS.tap.p95Ms);
}

// The sheet stays mounted (aria-hidden) while it animates out, so "a dialog exists" would be true before the tap and the
// gate could never fail. Open means a dialog that is not aria-hidden.
const SHEET_OPEN = `[...document.querySelectorAll('[role="dialog"]')].some((d) => d.getAttribute('aria-hidden') !== 'true')`;

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
  await tapGate(page, testInfo, 'tab tap', async (n) => {
    const samples: number[] = [];
    for (let i = 0; i < n; i++) samples.push(await tapCurrent(page, TABS[(i + 1) % TABS.length]!));
    return samples;
  });
});

test('choosing a theme repaints the app within the tap budget (p95)', async ({ page }, testInfo) => {
  await launch(page);
  await gotoTab(page, 'Settings');
  const themes = ['Dark', 'Light', 'Black', 'Light'] as const;
  await tapGate(page, testInfo, 'theme tap', async (n) => {
    const samples: number[] = [];
    for (let i = 0; i < n; i++) {
      const name = themes[i % themes.length]!;
      samples.push(await measureInput(page, `document.documentElement.dataset.theme === ${JSON.stringify(name.toLowerCase())}`, () => themeOption(page, name).tap()));
    }
    return samples;
  });
});

test('opening the Install help bottom sheet is within the tap budget (p95)', async ({ page }, testInfo) => {
  await launch(page);
  await gotoTab(page, 'Settings');
  await tapGate(page, testInfo, 'sheet open', async (n) => {
    const samples: number[] = [];
    for (let i = 0; i < n; i++) {
      samples.push(await measureInput(page, SHEET_OPEN, () => installHelpButton(page).tap()));
      await page.keyboard.press('Escape');
      await expect(sheet(page)).toBeHidden();
    }
    return samples;
  });
});

test('no long task blocks the main thread while using the tabs', async ({ page }) => {
  await launch(page);
  for (let i = 0; i < 12; i++) await tapCurrent(page, TABS[(i + 1) % TABS.length]!);
  const tasks = await longTasks(page);
  const worst = Math.max(0, ...tasks);
  expect(worst, `long tasks (ms): ${JSON.stringify(tasks.map(Math.round))}`).toBeLessThanOrEqual(BUDGETS.jank.maxLongTaskMs);
});
