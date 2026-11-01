#!/usr/bin/env node
/**
 * Real-user smoke against a deployed production build (Cloudflare Pages, preview, etc.).
 *
 *   npm run smoke:live -- https://pagenest-42f.pages.dev
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = resolve(repoRoot, 'tests');
const raw = process.argv[2];
if (!raw) {
  console.error('Usage: npm run smoke:live -- <production-url>');
  console.error('Example: npm run smoke:live -- https://pagenest-42f.pages.dev');
  process.exit(2);
}

const baseURL = raw.endsWith('/') ? raw : `${raw}/`;
const host = new URL(baseURL).hostname.replace(/[^\w.-]+/g, '-');

const env = {
  ...process.env,
  PAGENEST_BASE_URL: baseURL,
  PAGENEST_SKIP_BUILD: '1',
  PAGENEST_SMOKE_LIVE: '1',
  PAGENEST_SMOKE_LIVE_HOST: host,
};

const args = [
  'playwright',
  'test',
  'e2e/release-smoke.spec.ts',
  'e2e/release-smoke-live-upgrade.spec.ts',
  '--project=release-smoke-chromium',
  '--project=release-smoke-webkit',
  '--workers=1',
  '--retries=0',
];

console.log(`\n=== Live smoke @ ${baseURL} (360px Pixel + iPhone) ===\n`);
let r = spawnSync('npx', args, { cwd: testsDir, env, stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);

console.log(`\n=== Live read-aloud smoke @ ${baseURL} ===\n`);
const readAloudArgs = [
  'playwright',
  'test',
  'e2e/release-smoke-live-read-aloud.spec.ts',
  '--project=release-smoke-chromium',
  '--project=release-smoke-webkit',
  '--workers=1',
  '--retries=0',
];
r = spawnSync('npx', readAloudArgs, { cwd: testsDir, env, stdio: 'inherit' });
process.exit(r.status ?? 1);
