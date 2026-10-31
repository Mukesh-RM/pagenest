#!/usr/bin/env node
// Lighthouse quality gate (blueprint section 19 plus the "no lag" rule): PWA, Accessibility and Performance scores
// must meet the minimums in perf/budgets.ts (90 each today).
//
//   node lighthouse/run.mjs                      serve ../dist (run `npm run build` at the repo root first) and audit it
//   node lighthouse/run.mjs --url http://host/   audit an already running or deployed build
//   node lighthouse/run.mjs --dir fixtures/reference-app   serve and audit another folder
//   Besides every screen it audits two scenarios (--scenarios none: screens only; --scenarios only: just the scenarios): a mid-size library (BUDGETS.lighthouse.scenarios.libraryBooks
//   books seeded into IndexedDB) and a first launch in a fresh profile (onboarding visible). Each needs Performance >= 90 and CLS < BUDGETS.lighthouse.maxCls.
//   flags: --route /settings (one screen only; default is every screen in perf/budgets.ts)  --threshold 90 (one minimum for every category; default is perf/budgets.ts)  --preset mobile|desktop  --port <n>  --spa
//   Port: `PAGENEST_LIGHTHOUSE_PORT` → `PAGENEST_E2E_PORT` → free port (see docs/TESTING.md). `--port` overrides env.
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
import { seedLibrary } from '../e2e/support/library.ts';
import { RESUME_BOOK, seedResumeBook } from '../e2e/support/resume.ts';
import { resolveE2ePort } from '../../scripts/e2e/resolve-port.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const testsRoot = resolve(here, '..');

function parseArgs(argv) {
  const out = { threshold: undefined, preset: 'mobile', port: undefined, spa: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--spa') out.spa = true;
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
  }
  if (out.threshold !== undefined) out.threshold = Number(out.threshold);
  if (out.port !== undefined) out.port = Number(out.port);
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
if (args.port === undefined && !args.url && !process.env.PAGENEST_BASE_URL) {
  args.port = await resolveE2ePort('PAGENEST_LIGHTHOUSE_PORT');
}
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

const maxCls = BUDGETS.lighthouse.maxCls;
const reportsDir = resolve(here, 'reports');
let exitCode = 0;
const chromeFlags = ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'];

/** Runs Lighthouse on one URL and prints/enforces the three category minimums plus CLS. `slug` names the report files. */
async function auditTarget(chrome, config, { title, target, slug, storageReset }) {
  const flags = {
    port: chrome.port, output: ['json', 'html'], logLevel: 'error', onlyCategories: [...categories, 'best-practices'],
    disableStorageReset: !storageReset, // keep the "onboarding skipped" setting and the seeded books unless a scenario wants a clean profile
  };
  const result = await lighthouse(target, flags, config);
  if (!result?.lhr) throw new Error(`Lighthouse returned no result for ${target}`);
  const { lhr } = result;
  if (lhr.runtimeError) throw new Error(`${lhr.runtimeError.code}: ${lhr.runtimeError.message}`);
  const [json, html] = result.report;
  await writeFile(resolve(reportsDir, `lighthouse-${slug}.json`), json);
  await writeFile(resolve(reportsDir, `lighthouse-${slug}.html`), html);

  const landed = new URL(lhr.finalDisplayedUrl).pathname;
  console.log(`\n${title} (${lhr.finalDisplayedUrl})${landed !== new URL(target).pathname ? `  NOTE: landed on ${landed}` : ''}`);
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
  // Best practices are reported, not enforced (the enforced checks are the three categories and CLS); the elements behind each
  // failing audit are printed so the owner can fix them. label-content-name-mismatch is enforced by excellence/label-in-name.spec.ts.
  const bp = lhr.categories['best-practices'];
  if (bp) {
    console.log(`  info  Best practices: ${Math.round((bp.score ?? 0) * 100)}`);
    const failing = Object.values(lhr.audits).filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode !== 'manual' && a.scoreDisplayMode !== 'notApplicable' && (bp.auditRefs.some((r) => r.id === a.id && r.weight > 0) || a.id === 'label-content-name-mismatch'));
    for (const a of failing) {
      console.log(`        - ${a.id}: ${a.title}`);
      for (const item of (a.details?.items ?? []).slice(0, 4)) console.log(`            ${item.node?.selector ?? item.source?.url ?? ''} ${(item.node?.snippet ?? '').slice(0, 140)}`);
    }
  }
  const cls = lhr.audits['cumulative-layout-shift']?.numericValue ?? Number.NaN;
  const clsPass = cls < maxCls;
  if (!clsPass) exitCode = 1;
  console.log(`  ${clsPass ? 'PASS' : 'FAIL'}  Cumulative layout shift: ${Number.isFinite(cls) ? cls.toFixed(3) : 'n/a'} (maximum ${maxCls})`);
  const m = (id) => lhr.audits[id]?.displayValue ?? 'n/a';
  console.log(`  metrics: FCP ${m('first-contentful-paint')}, LCP ${m('largest-contentful-paint')}, TBT ${m('total-blocking-time')}, CLS ${m('cumulative-layout-shift')}, TTI ${m('interactive')}`);
}

let chrome;
let fresh;
try {
  await mkdir(reportsDir, { recursive: true });
  const config = args.preset === 'desktop'
    ? (await import('lighthouse/core/config/desktop-config.js')).default
    : undefined;
  console.log(`\nLighthouse ${args.preset}, minimum scores ${JSON.stringify(minScore)}, CLS under ${maxCls}, per screen`);

  chrome = await chromeLauncher.launch({ chromePath, chromeFlags });
  await skipOnboardingInProfile(chrome.port);
  for (const screen of args.scenarios === 'only' ? [] : screens) {
    await auditTarget(chrome, config, {
      title: screen.name, target: new URL(screen.path.replace(/^\//, ''), base).toString(),
      slug: screen.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), storageReset: false,
    });
  }

  if (!args.route && args.scenarios !== 'none') {
    // Scenario 1: a mid-size library. The books are written to IndexedDB through the storage contract, in the same profile.
    const books = BUDGETS.lighthouse.scenarios.libraryBooks;
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`);
    try {
      const page = await (browser.contexts()[0] ?? (await browser.newContext())).newPage();
      await page.goto(base);
      await page.getByRole('navigation').first().waitFor({ timeout: 15000 });
      await seedLibrary(page, { count: books }); // throws if the books did not land in IndexedDB; reloads the page
      await page.getByRole('main').getByText(/Book 0000\d/).first().waitFor({ timeout: 15000 }).catch(async (e) => {
        throw new Error(`no seeded book on screen after seeding: ${e.message.split('\n')[0]}; main says: "${(await page.getByRole('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)}"`);
      });
      await page.close();
    } finally { await browser.close(); }
    await auditTarget(chrome, config, { title: `Library with ${books}+ books`, target: base, slug: 'library-seeded', storageReset: false });

    // Scenario 1b: the same library with a "Welcome back" resume card (a book read to RESUME_BOOK.percent %, saved just now).
    {
      const b1 = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`);
      try {
        const page = await (b1.contexts()[0] ?? (await b1.newContext())).newPage();
        await page.goto(base);
        await page.getByRole('navigation').first().waitFor({ timeout: 15000 });
        await seedResumeBook(page); // writes the book and a newest progress row, reloads
        await page.getByRole('main').getByText(/welcome back/i).first().waitFor({ timeout: 15000 }).catch(() => { throw new Error(`the resume card did not render for "${RESUME_BOOK.title}"; the scenario would measure the wrong page`); });
        await page.close();
      } finally { await b1.close(); }
      await auditTarget(chrome, config, { title: `Library with ${books}+ books and the resume card`, target: base, slug: 'library-resume-card', storageReset: false });
    }

    // Scenario 2: first launch. A fresh Chrome profile, onboarding NOT skipped; checked to be on screen before auditing.
    fresh = await chromeLauncher.launch({ chromePath, chromeFlags });
    const b2 = await chromium.connectOverCDP(`http://127.0.0.1:${fresh.port}`);
    try {
      const page = await (b2.contexts()[0] ?? (await b2.newContext())).newPage();
      await page.goto(base);
      await page.getByRole('button', { name: /^skip$/i }).waitFor({ timeout: 15000 }); // onboarding is what a new user sees
      await page.close();
    } finally { await b2.close(); }
    await auditTarget(fresh, config, { title: 'First launch (fresh profile, onboarding visible)', target: base, slug: 'first-launch', storageReset: true });
  }
  console.log(`\nReports: ${reportsDir}/lighthouse-<screen>.html and .json`);
} catch (e) {
  console.error(`Lighthouse could not run: ${e.message}`);
  exitCode = 2;
} finally {
  if (chrome) await chrome.kill();
  if (fresh) await fresh.kill();
  if (server) server.kill();
}
process.exit(exitCode);
