// First launch to real book text on the production build: fresh browser profile, Skip, "Add the sample book".
// Usage: node support/perf.mjs [runs] [baseURL]. Prints one line per run and the median and worst.
import { chromium, devices } from '@playwright/test';
import { resolveE2ePort } from '../../../../scripts/e2e/resolve-port.mjs';
import { openSampleFromFirstLaunch, waitForBookText } from './app.mjs';

const runs = Number(process.argv[2] ?? 10);
const baseURL = process.argv[3] ?? `http://127.0.0.1:${await resolveE2ePort('PAGENEST_READER_PORT')}/`;
const browser = await chromium.launch();
const results = [];
for (const [name, use] of [['laptop', { viewport: { width: 1280, height: 800 } }], ['phone', devices['Pixel 7']]]) {
  const totals = [];
  for (let i = 0; i < runs; i++) {
    const context = await browser.newContext({ ...use, baseURL });
    const page = await context.newPage();
    const t0 = Date.now();
    await openSampleFromFirstLaunch(page);
    await waitForBookText(page, { min: 100 });
    totals.push(Date.now() - t0);
    await context.close();
  }
  const sorted = [...totals].sort((a, b) => a - b);
  results.push({ name, totals, median: sorted[Math.floor(sorted.length / 2)], worst: sorted.at(-1) });
}
for (const r of results) console.log(`${r.name}: taps 2, runs ${r.totals.join(' ')} ms, median ${r.median} ms, worst ${r.worst} ms`);
await browser.close();
