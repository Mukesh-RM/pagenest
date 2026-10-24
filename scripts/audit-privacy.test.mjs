// Tests for audit-privacy.mjs. Run: node --test scripts/audit-*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditProject, badPackageCategory, judgeUrl, loadAllowlist, parseExternalUrl, run, scanText } from './audit-privacy.mjs';

const SCRIPTS = path.dirname(new URL(import.meta.url).pathname);
const allow = loadAllowlist(path.join(SCRIPTS, 'audit-allowlist.json'));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pn-priv-'));
const write = (root, rel, content) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
};
const scan = (code, file = 'src/a.ts', opts) => scanText(code, file, allow, opts);
const fails = (fs_) => fs_.filter((f) => f.level === 'fail');
const rules = (fs_) => fs_.map((f) => `${f.level}:${f.rule}`);
const capture = (argv) => {
  const out = [];
  const code = run(argv, { log: (s = '') => out.push(s), errLog: (s) => out.push(s) });
  return { code, out: out.join('\n') };
};

test('same-origin, relative and allow-listed model downloads pass', () => {
  const code = `
    const a = await fetch('/models/kokoro.onnx');
    const b = await fetch('./voices/en.json');
    const c = await fetch(\`/api-less/\${name}.bin\`);
    await fetch('https://huggingface.co/rhasspy/piper-voices/resolve/main/en/x.onnx');
    await fetch('https://cdn-lfs.huggingface.co/repos/ab/cd/file');
    await fetch('https://cas-bridge.xethub.hf.co/x');
    await fetch('https://github.com/rhasspy/piper/releases/download/v1/voice.onnx');
    await fetch('https://raw.githubusercontent.com/rhasspy/piper/master/VOICES.md');
    navigator.serviceWorker.register('/sw.js');
    const w = new Worker(new URL('./w.ts', import.meta.url), { type: 'module' });
    const m = await import('./mod');
  `;
  assert.deepEqual(scan(code), []);
});

test('fetch / XHR / WebSocket / EventSource / importScripts / import() to unknown hosts fail', () => {
  const code = [
    "fetch('https://api.example.com/v1/books')",
    "const x = new XMLHttpRequest(); x.open('GET', 'https://evil.example/track')",
    "new WebSocket('wss://sock.example.org/live')",
    "new EventSource('https://sse.example.org/stream')",
    "importScripts('https://cdn.example.net/lib.js')",
    "await import('https://esm.example.dev/mod.js')",
    "new Worker('https://example.com/w.js')",
    "fetch('//proto-relative.example.com/x')",
    "fetch('http://huggingface.co.evil.example/x')",
    "fetch('https://github.com/someone/repo/archive/main.zip')",
    "axios.get('https://api.example.com/x')",
  ].join('\n');
  const f = fails(scan(code));
  const lines = new Set(f.map((x) => x.line));
  for (let i = 1; i <= 11; i++) assert.ok(lines.has(i), `line ${i} should fail: ${code.split('\n')[i - 1]}`);
});

test('constant URL used by fetch is resolved', () => {
  const f = fails(scan("const API = 'https://api.example.com/x';\nexport const go = () => fetch(API);"));
  assert.equal(f.length, 1);
  assert.equal(f[0].line, 2);
  assert.match(f[0].detail, /API = https:\/\/api\.example\.com/);
});

test('dynamic URLs and localhost are warnings, not failures', () => {
  const f = scan("fetch(url);\nfetch(`https://${host}/x`);\nfetch('http://localhost:5000/render');\nnew WebSocket(u);");
  assert.equal(fails(f).length, 0);
  assert.ok(f.filter((x) => x.level === 'warn').length >= 3);
});

test('external URL literal that is only a visible link is a warning', () => {
  const f = scan("export const REPO = 'https://github.com/Mukesh-RM/pagenest';");
  assert.deepEqual(rules(f), ['warn:external-url-literal']);
  assert.deepEqual(scan('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'src/Icon.tsx'), []);
});

test('analytics, ads, payment and login SDK usage fails', () => {
  const cases = {
    "gtag('config', 'G-XXXXXXX');": /gtag/,
    'window.dataLayer = window.dataLayer || [];': /dataLayer/,
    "fbq('init', '123');": /Facebook/,
    "mixpanel.track('open');": /Mixpanel/,
    "posthog.capture('x');": /PostHog/,
    "Sentry.init({ dsn: '' });": /Sentry/,
    "hj('event', 'x');": /Hotjar/,
    '(adsbygoogle = window.adsbygoogle || []).push({});': /ads/i,
    "const s = await loadStripe('pk_x');": /Stripe/,
    "paypal.Buttons({}).render('#x');": /PayPal/,
    'await signInWithPopup(auth, provider);': /Firebase/,
    "await supabase.auth.signInWithPassword({});": /Supabase/,
    "navigator.sendBeacon('/x', data);": /sendBeacon/,
  };
  for (const [code, re] of Object.entries(cases)) {
    const f = fails(scan(code));
    assert.ok(f.some((x) => re.test(x.detail)), `${code} -> ${JSON.stringify(f)}`);
  }
});

test('imports of tracker, payment and auth packages fail', () => {
  const code = "import posthog from 'posthog-js';\nimport { loadStripe } from '@stripe/stripe-js';\nimport * as Sentry from '@sentry/react';\nconst a = require('firebase/auth');\nimport { useAuth } from '@clerk/clerk-react';";
  const f = fails(scan(code)).filter((x) => x.rule === 'sdk-import');
  assert.equal(f.length, 5);
  assert.deepEqual(scan("import React from 'react';\nimport { create } from 'zustand';\nimport Dexie from 'dexie';\nimport { wrap } from 'comlink';\nimport './x.css';"), []);
});

test('tracker and CDN hosts fail in any file type; comments in code are ignored', () => {
  assert.ok(fails(scan("const s = 'https://www.google-analytics.com/collect';")).length);
  assert.ok(fails(scan("const u = 'https://js.stripe.com/v3';")).length);
  assert.ok(fails(scan('@import url("https://fonts.googleapis.com/css2?family=Inter");', 'src/a.css')).length);
  assert.ok(fails(scan('a { background: url(https://cdn.jsdelivr.net/x.png) }', 'src/a.css')).length);
  assert.ok(fails(scan('{"start_url":"https://o.ingest.sentry.io/x"}', 'public/manifest.json')).length);
  assert.deepEqual(fails(scan('// we do not use https://www.googletagmanager.com/gtm.js')), []);
  assert.deepEqual(fails(scan(' * no https://fonts.googleapis.com here')), []);
});

test('HTML: external script, link, font, iframe, img, form fail; local ones pass; canonical link ignored', () => {
  const bad = `<!doctype html><html><head>
<link rel="preconnect" href="https://fonts.gstatic.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora">
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script async src="//cdn.example.com/x.js"></script>
<iframe src="https://www.youtube.com/embed/x"></iframe>
<img src="https://images.example.com/a.png">
<form action="https://forms.example.com/post"></form>
</head></html>`;
  const f = fails(scan(bad, 'index.html'));
  const lines = new Set(f.map((x) => x.line));
  for (const l of [2, 3, 4, 5, 6, 7, 8]) assert.ok(lines.has(l), `HTML line ${l}`);
  const good = `<!doctype html><html><head>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="/assets/index.css">
<link rel="canonical" href="https://pagenest.pages.dev/">
<script type="module" src="/src/main.tsx"></script>
</head></html>`;
  assert.deepEqual(fails(scan(good, 'index.html')), []);
});

test('inline ignore with a reason silences one line; without a reason it does not', () => {
  assert.deepEqual(fails(scan("fetch('https://api.example.com/x'); // audit-ignore: reviewed, user-initiated backup upload")), []);
  assert.equal(fails(scan("fetch('https://api.example.com/x'); // audit-ignore:")).length, 1);
});

test('vendor / minified files only check tracker and CDN hosts', () => {
  const minified = `${'a'.repeat(5000)}fetch("https://example.org/data")${'b'.repeat(10)}`;
  const r = auditProjectFromFiles({ 'public/vendor/lib.min.js': minified });
  assert.deepEqual(r.findings, []);
  const tracked = auditProjectFromFiles({ 'public/vendor/lib.min.js': `${minified};var u="https://www.google-analytics.com/a"` });
  assert.equal(fails(tracked.findings).length, 1);
});

function auditProjectFromFiles(files, pkg) {
  const root = tmp();
  for (const [k, v] of Object.entries(files)) write(root, k, v);
  if (pkg) write(root, 'package.json', pkg);
  return auditProject(root);
}

test('package.json dependency names are checked in all dependency groups', () => {
  const r = auditProjectFromFiles({}, { name: 'x', dependencies: { react: '^18', 'posthog-js': '^1' }, devDependencies: { '@sentry/browser': '^8', vitest: '^2' }, optionalDependencies: { stripe: '^1' } });
  const f = fails(r.findings);
  assert.deepEqual(f.map((x) => x.detail.split(':')[1].trim().split(' ')[0]).sort(), ['@sentry/browser', 'posthog-js', 'stripe']);
  assert.ok(f.every((x) => x.rule === 'bad-dependency' && x.line > 1));
  assert.equal(badPackageCategory('react'), null);
  for (const n of ['firebase', 'next-auth', '@clerk/nextjs', '@supabase/supabase-js', 'auth0-js', 'mixpanel-browser', 'react-ga4', 'react-adsense', '@paypal/react-paypal-js', 'amplitude-js', 'hotjar', 'plausible-tracker']) assert.ok(badPackageCategory(n), n);
  for (const n of ['dexie', 'comlink', 'jszip', 'pdfjs-dist', 'onnxruntime-web', 'minisearch', 'lucide-react', 'vite-plugin-pwa', 'workbox-window', 'zustand', 'react-router-dom', '@radix-ui/react-dialog']) assert.equal(badPackageCategory(n), null, n);
});

test('a clean PageNest-style project passes with exit 0', () => {
  const root = tmp();
  write(root, 'package.json', { name: 'pagenest', dependencies: { react: '^18.3.0', dexie: '^4', comlink: '^4', zustand: '^5', jszip: '^3' } });
  write(root, 'index.html', '<!doctype html><html><head><link rel="manifest" href="/manifest.webmanifest"><script type="module" src="/src/main.tsx"></script></head><body><div id="root"></div></body></html>');
  write(root, 'vite.config.ts', "import { defineConfig } from 'vite';\nexport default defineConfig({ base: '/' });");
  write(root, 'src/main.tsx', "import React from 'react';\nexport const load = () => fetch('/models/voices.json');");
  write(root, 'src/styles.css', "@font-face { font-family: 'Inter'; src: url('/fonts/inter.woff2') format('woff2'); }");
  write(root, 'public/manifest.webmanifest', { name: 'PageNest', start_url: '/' });
  const r = capture(['--root', root]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /RESULT: PASS/);
});

test('failures print file:line evidence and exit 1; --strict makes warnings fail', () => {
  const root = tmp();
  write(root, 'src/net.ts', "export const a = 1;\nfetch('https://api.example.com/x');\n");
  write(root, 'src/dyn.ts', 'export const g = (u: string) => fetch(u);\n');
  const r = capture(['--root', root]);
  assert.equal(r.code, 1);
  assert.match(r.out, /src\/net\.ts:2 {2}\[external-call\]/);
  const onlyWarn = tmp();
  write(onlyWarn, 'src/dyn.ts', 'export const g = (u: string) => fetch(u);\n');
  assert.equal(capture(['--root', onlyWarn]).code, 0);
  assert.equal(capture(['--root', onlyWarn, '--strict']).code, 1);
});

test('empty repo (no src, no package.json) passes gracefully', () => {
  const r = capture(['--root', tmp()]);
  assert.equal(r.code, 0);
  assert.match(r.out, /no app code yet/);
});

test('test files are skipped unless --include-tests; custom allow-list file is honoured', () => {
  const root = tmp();
  write(root, 'src/a.test.ts', "fetch('https://api.example.com/x');");
  write(root, 'tests/e2e.ts', "fetch('https://api.example.com/y');");
  assert.equal(capture(['--root', root]).code, 0);
  assert.equal(capture(['--root', root, '--include-tests']).code, 1);
  write(root, 'src/b.ts', "fetch('https://models.mycdn.example/x.onnx');");
  assert.equal(capture(['--root', root]).code, 1);
  write(root, 'allow.json', { allowedHosts: [{ host: 'models.mycdn.example', reason: 'test' }] });
  assert.equal(capture(['--root', root, '--allowlist', path.join(root, 'allow.json')]).code, 0);
});

test('allow-list helpers: wildcard hosts, path regex, relative URLs', () => {
  assert.equal(judgeUrl('https://cdn-lfs.huggingface.co/x', allow).level, 'ok');
  assert.equal(judgeUrl('https://huggingface.co.evil.com/x', allow).level, 'fail');
  assert.equal(judgeUrl('https://github.com/a/b/releases/download/v1/x.onnx', allow).level, 'ok');
  assert.equal(judgeUrl('https://github.com/a/b', allow).level, 'fail');
  assert.equal(judgeUrl('/local/x', allow).level, 'ok');
  assert.equal(judgeUrl('http://127.0.0.1:8080/x', allow).level, 'warn');
  assert.equal(parseExternalUrl('model.onnx'), null);
  assert.equal(parseExternalUrl('//cdn.example.com/a').host, 'cdn.example.com');
});

test('the shipped allow-list names only model-download hosts', () => {
  const hosts = allow.allowed.map((e) => e.host);
  assert.ok(hosts.includes('huggingface.co'));
  assert.ok(hosts.includes('*.huggingface.co'));
  assert.ok(!hosts.some((h) => /google|analytics|stripe|cdn\.jsdelivr|unpkg/.test(h)));
});
