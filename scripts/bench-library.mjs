#!/usr/bin/env node
// Measures how long the first library query takes after a single write, with 5,000 books.
//
//   node scripts/bench-library.mjs [--books 5000] [--runs 40] [--node] [--browser]
//
// --node     fake-indexeddb in Node (default when no flag is given, plus the browser if Chrome is available)
// --browser  real IndexedDB in Chrome, through Playwright (a throwaway page; nothing is sent anywhere)
// Prints JSON. docs/DATA_LAYER.md has the numbers and what they mean.
import { build } from 'esbuild';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};
const books = flag('books', 5000);
const runs = flag('runs', 40);
const wantNode = args.includes('--node') || !args.includes('--browser');
const wantBrowser = args.includes('--browser') || !args.includes('--node');
const root = resolve(import.meta.dirname, '..');
const out = mkdtempSync(join(tmpdir(), 'pn-bench-'));
const common = {
  entryPoints: [join(root, 'scripts/bench/library-bench-core.mjs')],
  bundle: true,
  alias: { '@': join(root, 'src') },
  logLevel: 'error',
  minify: false,
};
const report = {};

if (wantNode) {
  // Written inside node_modules so the bundle can resolve fake-indexeddb from the project.
  const file = join(root, 'node_modules', '.bench', 'node.mjs');
  await build({
    ...common,
    outfile: file,
    platform: 'node',
    format: 'esm',
    banner: { js: "import 'fake-indexeddb/auto';" },
    external: ['fake-indexeddb'],
  });
  const mod = await import(pathToFileURL(file).href);
  report.node = await mod.runBench({ books, runs });
}

if (wantBrowser) {
  const chrome = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);
  const file = join(out, 'browser.js');
  await build({ ...common, outfile: file, platform: 'browser', format: 'iife', globalName: 'Bench', target: 'es2022' });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const page = await browser.newPage();
  // Serve a tiny page from a localhost origin (a secure context, like the app) without any network: IndexedDB needs a real origin.
  await page.route('http://localhost:4173/**', (route) =>
    route.fulfill({ contentType: route.request().url().endsWith('.js') ? 'text/javascript' : 'text/html', body: route.request().url().endsWith('.js') ? readFileSync(file) : '<!doctype html><title>bench</title>' }),
  );
  await page.goto('http://localhost:4173/index.html');
  await page.addScriptTag({ url: 'http://localhost:4173/bench.js' });
  report.browser = {
    userAgent: await page.evaluate(() => navigator.userAgent),
    ...(await page.evaluate(([b, r]) => Bench.runBench({ books: b, runs: r }), [books, runs])),
  };
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
