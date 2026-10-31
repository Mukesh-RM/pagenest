#!/usr/bin/env node
// Picks a free port, exports base URL for Playwright, then runs the reader e2e suite (shared server for all workers).
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFreePort } from './get-port.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const e2eRoot = join(here, '..');
const repoRoot = join(e2eRoot, '..', '..', '..', '..');

const port = await getFreePort();
const baseURL = `http://127.0.0.1:${port}/`;
const env = {
  ...process.env,
  PN_READER_E2E_PORT: String(port),
  PN_READER_E2E_BASE_URL: baseURL,
};

const args = process.argv.slice(2);
const pwArgs = ['playwright', 'test', '-c', join(e2eRoot, 'playwright.config.mjs'), ...args];
if (!args.some((a) => a.startsWith('--workers'))) pwArgs.push('--workers=2');

console.log(`[reader e2e] base URL ${baseURL}`);

const result = spawnSync('npx', pwArgs, { cwd: repoRoot, env, stdio: 'inherit' });
process.exit(result.status ?? 1);
