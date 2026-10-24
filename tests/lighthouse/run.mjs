#!/usr/bin/env node
// Lighthouse quality gate (blueprint section 19 plus the "no lag" rule): PWA, Accessibility and Performance scores
// must meet the minimums in perf/budgets.ts (90 each today).
//
//   node lighthouse/run.mjs                      serve ../dist (run `npm run build` at the repo root first) and audit it
//   node lighthouse/run.mjs --url http://host/   audit an already running or deployed build
//   node lighthouse/run.mjs --dir fixtures/reference-app   serve and audit another folder
//   flags: --route /settings (one screen only; default is every screen in perf/budgets.ts)  --threshold 90 (one minimum for every category; default is perf/budgets.ts)  --preset mobile|desktop  --port 4174  --spa
//
// Run it with `node --import tsx lighthouse/run.mjs` (npm run lighthouse does) so it can read the TypeScript budgets.
// Lighthouse is pinned to 11.x because Lighthouse 12 removed the PWA category that blueprint 19 asks for.
// Exit code 0 = all categories pass, 1 = a score is below the threshold, 2 = the audit could not run.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { BUDGETS } from '../perf/budgets.ts';

const here = dirname(fileURLToPath(import.meta.url));
const testsRoot = resolve(here, '..');

function parseArgs(argv) {
  const out = { threshold: undefined, preset: 'mobile', port: 4174, spa: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--spa') out.spa = true;
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
  }
  if (out.threshold !== undefined) out.threshold = Number(out.threshold);
  out.port = Number(out.port);
  return out;
}

async function waitForUrl(url, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server did not answer at ${url}`);
}

const args = parseArgs(process.argv.slice(2));
let server;
let url = args.url ?? process.env.PAGENEST_BASE_URL;
if (!url) {
  const dir = resolve(testsRoot, args.dir ?? '../dist');
  server = spawn(process.execPath, [resolve(testsRoot, 'fixtures/serve.mjs'), dir, String(args.port)], {
    stdio: 'inherit', env: { ...process.env, SPA: args.spa || !args.dir ? '1' : process.env.SPA ?? '' }, // the real app is a single-page app: deep links need the fallback
  });
  url = `http://127.0.0.1:${args.port}/`;
  try { await waitForUrl(url); }
  catch (e) { console.error(e.message, `(is ${dir} built?)`); server.kill(); process.exit(2); }
}

const chromePath = process.env.CHROME_PATH || chromium.executablePath();
const base = url.endsWith('/') ? url : `${url}/`;
const screens = args.route
  ? [{ name: args.route, path: args.route }]
  : BUDGETS.excellence.screens;
const minScore = args.threshold === undefined
  ? BUDGETS.lighthouse.minScore
  : { pwa: args.threshold, accessibility: args.threshold, performance: args.threshold };
const categories = ['pwa', 'accessibility', 'performance'];

/** First launch shows onboarding. Open the app once in this Chrome profile and press Skip, so every audited screen is the real one. */
async function skipOnboardingInProfile(port) {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  try {
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = await context.newPage();
    await page.goto(base);
    const skip = page.getByRole('button', { name: /^skip$/i });
    const nav = page.getByRole('navigation').first();
    await skip.or(nav).first().waitFor({ timeout: 15000 });
    if (await skip.isVisible()) {
      await skip.click();
      await nav.waitFor({ timeout: 15000 });
      await page.waitForTimeout(500); // let the setting reach IndexedDB
    }
    await page.close();
  } finally {
    await browser.close(); // disconnects only; Chrome stays up for Lighthouse
  }
}

let chrome;
let exitCode = 0;
try {
  chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  await skipOnboardingInProfile(chrome.port);
  const config = args.preset === 'desktop'
    ? (await import('lighthouse/core/config/desktop-config.js')).default
    : undefined;
  const dir = resolve(here, 'reports');
  await mkdir(dir, { recursive: true });

  console.log(`\nLighthouse ${args.preset}, minimum scores ${JSON.stringify(minScore)}, per screen`);
  for (const screen of screens) {
    const target = new URL(screen.path.replace(/^\//, ''), base).toString();
    const flags = {
      port: chrome.port, output: ['json', 'html'], logLevel: 'error', onlyCategories: categories,
      disableStorageReset: true, // keep the "onboarding skipped" setting
    };
    const result = await lighthouse(target, flags, config);
    if (!result?.lhr) throw new Error(`Lighthouse returned no result for ${target}`);
    const { lhr } = result;
    if (lhr.runtimeError) throw new Error(`${lhr.runtimeError.code}: ${lhr.runtimeError.message}`);
    const slug = screen.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const [json, html] = result.report;
    await writeFile(resolve(dir, `lighthouse-${slug}.json`), json);
    await writeFile(resolve(dir, `lighthouse-${slug}.html`), html);

    const landed = new URL(lhr.finalDisplayedUrl).pathname;
    console.log(`\n${screen.name} (${lhr.finalDisplayedUrl})${landed !== new URL(target).pathname ? `  NOTE: landed on ${landed}` : ''}`);
    for (const id of categories) {
      const cat = lhr.categories[id];
      const score = Math.round((cat.score ?? 0) * 100);
      const pass = score >= minScore[id];
      if (!pass) exitCode = 1;
      console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${cat.title}: ${score} (minimum ${minScore[id]})`);
      if (!pass) {
        for (const ref of cat.auditRefs) {
          const audit = lhr.audits[ref.id];
          if (ref.weight > 0 && audit.score !== null && audit.score < 1) {
            console.log(`        - ${audit.id}: ${audit.title}${audit.displayValue ? ` (${audit.displayValue})` : ''}`);
          }
        }
      }
    }
    const m = (id) => lhr.audits[id]?.displayValue ?? 'n/a';
    console.log(`  metrics: FCP ${m('first-contentful-paint')}, LCP ${m('largest-contentful-paint')}, TBT ${m('total-blocking-time')}, CLS ${m('cumulative-layout-shift')}, TTI ${m('interactive')}`);
  }
  console.log(`\nReports: ${dir}/lighthouse-<screen>.html and .json`);
} catch (e) {
  console.error(`Lighthouse could not run: ${e.message}`);
  exitCode = 2;
} finally {
  if (chrome) await chrome.kill();
  if (server) server.kill();
}
process.exit(exitCode);
