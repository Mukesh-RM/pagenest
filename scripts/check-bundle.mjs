#!/usr/bin/env node
// Bundle budget check. Fails (exit code 1) when the first load of the built app is too big.
//
//   node scripts/check-bundle.mjs [distDir]
//
// "First load" is what index.html pulls in before anything is drawn: its module script, its
// modulepreload links and its stylesheets. Sizes are gzip level 9, which is close to what a
// CDN sends. Lazy chunks (tabs, onboarding, the data worker) are checked one by one too, so no
// single screen can grow into a second app. Budgets and the reasoning are in docs/PERFORMANCE.md.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

/** Budgets in kilobytes (1 kB = 1000 bytes), gzip. Change them only together with docs/PERFORMANCE.md. */
export const BUDGETS_KB = {
  initialJs: 120,
  initialCss: 12,
  lazyChunk: 40,
};

const kb = (bytes) => bytes / 1000;
const gzipSize = (file) => gzipSync(readFileSync(file), { level: 9 }).length;

/** Asset paths referenced by index.html, by kind. */
export function firstLoadAssets(html) {
  const js = new Set();
  const css = new Set();
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) ?? []) {
    const attr = (name) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i').exec(tag)?.[1];
    if (/^<script/i.test(tag) && /type\s*=\s*["']module["']/i.test(tag)) {
      const src = attr('src');
      if (src) js.add(src);
    } else if (/^<link/i.test(tag)) {
      const rel = attr('rel');
      const href = attr('href');
      if (!href) continue;
      if (rel === 'modulepreload') js.add(href);
      else if (rel === 'stylesheet') css.add(href);
    }
  }
  return { js: [...js], css: [...css] };
}

/** Run the check. Returns `{ ok, lines }`; does not exit or print. */
export function checkBundle(distDir, budgets = BUDGETS_KB) {
  const dist = resolve(distDir);
  const indexPath = join(dist, 'index.html');
  if (!existsSync(indexPath)) return { ok: false, lines: [`No ${indexPath}. Run the build first.`] };

  const assets = firstLoadAssets(readFileSync(indexPath, 'utf8'));
  const local = (href) => join(dist, href.replace(/^\.?\/+/, ''));
  const lines = [];
  let ok = true;

  const sum = (hrefs) => hrefs.reduce((total, href) => total + (existsSync(local(href)) ? gzipSize(local(href)) : 0), 0);
  const missing = [...assets.js, ...assets.css].filter((href) => !existsSync(local(href)));
  if (missing.length > 0) return { ok: false, lines: [`index.html refers to missing files: ${missing.join(', ')}`] };
  if (assets.js.length === 0) return { ok: false, lines: ['index.html has no module script, so the first-load size cannot be measured.'] };

  const report = (label, sizeKb, budgetKb) => {
    const pass = sizeKb <= budgetKb;
    if (!pass) ok = false;
    lines.push(`${pass ? 'ok  ' : 'FAIL'} ${label}: ${sizeKb.toFixed(2)} kB gzip (budget ${budgetKb} kB)`);
  };

  report('initial JS', kb(sum(assets.js)), budgets.initialJs);
  report('initial CSS', kb(sum(assets.css)), budgets.initialCss);

  const assetsDir = join(dist, 'assets');
  const initial = new Set(assets.js.map((h) => h.split('/').pop()));
  if (existsSync(assetsDir)) {
    for (const name of readdirSync(assetsDir).filter((n) => n.endsWith('.js') && !initial.has(n)).sort()) {
      report(`lazy chunk ${name}`, kb(gzipSize(join(assetsDir, name))), budgets.lazyChunk);
    }
  }
  return { ok, lines };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { ok, lines } = checkBundle(process.argv[2] ?? 'dist');
  console.log(['Bundle budget', ...lines].join('\n'));
  if (!ok) {
    console.error('\nThe bundle is over budget. See docs/PERFORMANCE.md before raising a limit.');
    process.exit(1);
  }
}
