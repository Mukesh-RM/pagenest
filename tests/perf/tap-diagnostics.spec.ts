import { readFileSync } from "node:fs";
import { test } from "@playwright/test";
import { gotoTab, launch, themeOption } from '../e2e/support/app';
import { measureInput, percentile, throttleCpu } from '../e2e/support/perf';
import { BUDGETS } from './budgets';

// Opt-in diagnostics (TAP_DIAG=1), not a gate. Splits each theme-tap sample into where the time went, to tell real jank
// (the app's own main-thread work) from measurement noise (a busy machine delaying input dispatch or frames):
//   inputDelay   pointerdown timestamp -> handler starts   (main thread busy, or the browser process starved)
//   processing   handler start -> handler end              (the app's own JavaScript: the part the UI/UX owner controls)
//   present      handler end -> frame presented            (style, layout, paint, compositor: also hit by machine load)
// from the Event Timing API (what INP is built on), next to the gate's own measure. Also prints the machine load average.
// Run: TAP_DIAG=1 PAGENEST_PORT=4395 npx playwright test perf/tap-diagnostics.spec.ts --project=perf-chromium-mobile --repeat-each=20 --workers=1

test.skip(!process.env.TAP_DIAG, 'diagnostics only: set TAP_DIAG=1');

test('theme tap: where the time goes', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __ev: { type: string; start: number; inputDelay: number; processing: number; present: number }[] };
    w.__ev = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { name: string; startTime: number; processingStart: number; processingEnd: number; duration: number }[]) {
        if (e.name !== 'pointerup' && e.name !== 'click') continue;
        w.__ev.push({ type: e.name, start: e.startTime, inputDelay: e.processingStart - e.startTime, processing: e.processingEnd - e.processingStart, present: e.startTime + e.duration - e.processingEnd });
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
  });
  await launch(page);
  await gotoTab(page, 'Settings');
  await throttleCpu(page, BUDGETS.tap.cpuThrottle);
  const load = () => readFileSync("/proc/loadavg", "utf8").split(' ')[0];
  const rows: { total: number; inputDelay: number; processing: number; present: number }[] = [];
  const themes = ['Dark', 'Light', 'Black', 'Light'] as const;
  for (let i = 0; i < BUDGETS.tap.samples + 4; i++) {
    const name = themes[i % themes.length]!;
    await page.evaluate(() => { (window as unknown as { __ev: unknown[] }).__ev.length = 0; });
    const total = await measureInput(page, `document.documentElement.dataset.theme === ${JSON.stringify(name.toLowerCase())}`, () => themeOption(page, name).tap());
    await page.waitForTimeout(60);
    const ev = await page.evaluate(() => (window as unknown as { __ev: { inputDelay: number; processing: number; present: number }[] }).__ev);
    const worst = ev.sort((a, b) => b.inputDelay + b.processing + b.present - (a.inputDelay + a.processing + a.present))[0];
    if (i >= 4) rows.push({ total, inputDelay: worst?.inputDelay ?? 0, processing: worst?.processing ?? 0, present: worst?.present ?? 0 }); // first 4 = warm-up
  }
  const p = (k: keyof (typeof rows)[number], q: number) => percentile(rows.map((r) => r[k]), q).toFixed(0);
  console.log(`diag load=${load()} n=${rows.length} total p50/p95/max=${p('total', 50)}/${p('total', 95)}/${p('total', 100)} | inputDelay p95=${p('inputDelay', 95)} max=${p('inputDelay', 100)} | processing p95=${p('processing', 95)} max=${p('processing', 100)} | present p95=${p('present', 95)} max=${p('present', 100)}`);
});
