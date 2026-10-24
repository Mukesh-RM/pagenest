import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { writeFileSync } from 'node:fs';
const base = process.env.LH_BASE ?? 'http://127.0.0.1:5198/';
const modes = (process.env.LH_MODES ?? 'first,library').split(',');
const runs = Number(process.env.LH_RUNS ?? 3);
const out = {};
for (const mode of modes) {
  out[mode] = [];
  for (let i = 0; i < runs; i++) {
    const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
    try {
      if (mode === 'library') {
        const browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`);
        const ctx = browser.contexts()[0] ?? (await browser.newContext());
        const page = await ctx.newPage();
        await page.goto(base);
        const skip = page.getByRole('button', { name: /^skip$/i });
        await skip.waitFor({ timeout: 20000 });
        await skip.click();
        await page.getByRole('navigation').first().waitFor();
        await page.waitForTimeout(800);
        await page.close(); await browser.close();
      }
      const r = await lighthouse(base, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'pwa'], disableStorageReset: mode === 'library' });
      const l = r.lhr;
      const a = (id) => l.audits[id];
      const row = {
        perf: Math.round(l.categories.performance.score * 100), a11y: Math.round(l.categories.accessibility.score * 100), bp: Math.round(l.categories['best-practices'].score * 100), pwa: Math.round(l.categories.pwa.score * 100),
        fcp: a('first-contentful-paint').displayValue, lcp: a('largest-contentful-paint').displayValue, tbt: a('total-blocking-time').displayValue, cls: a('cumulative-layout-shift').displayValue, si: a('speed-index').displayValue, tti: a('interactive').displayValue,
        lcpEl: a('largest-contentful-paint-element')?.details?.items?.[0]?.items?.[0]?.node?.snippet?.slice(0, 80),
        failing: Object.values(l.audits).filter((x) => x.score !== null && x.score < 0.9 && x.scoreDisplayMode !== 'informative' && x.scoreDisplayMode !== 'notApplicable' && x.scoreDisplayMode !== 'manual').map((x) => x.id).slice(0, 14),
        finalUrl: l.finalDisplayedUrl,
      };
      if (process.env.LH_SAVE) writeFileSync(`/tmp/lh-${mode}-${i}.json`, JSON.stringify(l));
      out[mode].push(row);
      console.log(mode, i + 1, JSON.stringify(row));
    } finally { await chrome.kill(); }
  }
}
const med = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const [mode, rows] of Object.entries(out)) console.log('MEDIAN', mode, 'perf', med(rows.map((r) => r.perf)), 'a11y', med(rows.map((r) => r.a11y)), 'all perf', rows.map((r) => r.perf).join('/'));
