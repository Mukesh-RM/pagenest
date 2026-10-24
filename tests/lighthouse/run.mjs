#!/usr/bin/env node
// Lighthouse quality gate (blueprint section 19): PWA and Accessibility scores must be 90 or more.
//
//   node lighthouse/run.mjs                      serve ../dist (run `npm run build` at the repo root first) and audit it
//   node lighthouse/run.mjs --url http://host/   audit an already running or deployed build
//   node lighthouse/run.mjs --dir fixtures/reference-app   serve and audit another folder
//   flags: --threshold 90  --preset mobile|desktop  --port 4174  --spa
//
// Lighthouse is pinned to 11.x because Lighthouse 12 removed the PWA category that blueprint 19 asks for.
// Exit code 0 = all categories pass, 1 = a score is below the threshold, 2 = the audit could not run.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const here = dirname(fileURLToPath(import.meta.url));
const testsRoot = resolve(here, '..');

function parseArgs(argv) {
  const out = { threshold: 90, preset: 'mobile', port: 4174, spa: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--spa') out.spa = true;
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
  }
  out.threshold = Number(out.threshold);
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
    stdio: 'inherit', env: { ...process.env, SPA: args.spa ? '1' : process.env.SPA ?? '' },
  });
  url = `http://127.0.0.1:${args.port}/`;
  try { await waitForUrl(url); }
  catch (e) { console.error(e.message, `(is ${dir} built?)`); server.kill(); process.exit(2); }
}

const chromePath = process.env.CHROME_PATH || chromium.executablePath();
let chrome;
let exitCode = 0;
try {
  chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  const flags = { port: chrome.port, output: ['json', 'html'], logLevel: 'error', onlyCategories: ['pwa', 'accessibility'] };
  const config = args.preset === 'desktop'
    ? (await import('lighthouse/core/config/desktop-config.js')).default
    : undefined;
  const result = await lighthouse(url, flags, config);
  if (!result?.lhr) throw new Error('Lighthouse returned no result');
  const { lhr } = result;
  if (lhr.runtimeError) throw new Error(`${lhr.runtimeError.code}: ${lhr.runtimeError.message}`);

  const dir = resolve(here, 'reports');
  await mkdir(dir, { recursive: true });
  const [json, html] = result.report;
  await writeFile(resolve(dir, 'lighthouse.json'), json);
  await writeFile(resolve(dir, 'lighthouse.html'), html);

  console.log(`\nLighthouse ${lhr.lighthouseVersion} on ${lhr.finalDisplayedUrl} (${args.preset}), threshold ${args.threshold}`);
  for (const id of ['pwa', 'accessibility']) {
    const cat = lhr.categories[id];
    const score = Math.round((cat.score ?? 0) * 100);
    const pass = score >= args.threshold;
    if (!pass) exitCode = 1;
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${cat.title}: ${score}`);
    if (!pass) {
      for (const ref of cat.auditRefs) {
        const audit = lhr.audits[ref.id];
        if (ref.weight > 0 && audit.score !== null && audit.score < 1) {
          console.log(`        - ${audit.id}: ${audit.title}${audit.displayValue ? ` (${audit.displayValue})` : ''}`);
        }
      }
    }
  }
  console.log(`Reports: ${dir}/lighthouse.html and lighthouse.json`);
} catch (e) {
  console.error(`Lighthouse could not run: ${e.message}`);
  exitCode = 2;
} finally {
  if (chrome) await chrome.kill();
  if (server) server.kill();
}
process.exit(exitCode);
