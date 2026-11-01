#!/usr/bin/env node
/**
 * Upgrade smoke: serve the parent commit's build, import an EPUB, rebuild to HEAD, verify the same
 * browser profile still opens the book (OPFS / cache bytes must survive app updates).
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { extname, join as pathJoin, resolve as pathResolve, sep } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const testsDir = join(repoRoot, 'tests');
const parent = spawnSync('git', ['rev-parse', 'HEAD~1'], { cwd: repoRoot, encoding: 'utf8' });
if (parent.status !== 0) {
  console.error('Could not resolve HEAD~1 for upgrade smoke.');
  process.exit(1);
}
const parentSha = parent.stdout.trim();
const port = 4188;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: repoRoot, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function serveDist(dist) {
  return createServer((req, res) => {
    const { pathname } = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
    let file = pathResolve(pathJoin(dist, pathname));
    if (!file.startsWith(dist + sep) || !existsSync(file) || statSync(file).isDirectory()) {
      file = pathJoin(dist, 'index.html');
    }
    const body = readFileSync(file);
    res.writeHead(200, {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  }).listen(port, '127.0.0.1');
}

const worktree = mkdtempSync(join(tmpdir(), 'pagenest-upgrade-'));
const profile = mkdtempSync(join(tmpdir(), 'pagenest-upgrade-profile-'));

try {
  run('git', ['worktree', 'add', '--detach', worktree, parentSha]);
  run('npm', ['ci'], { cwd: worktree });
  run('npm', ['run', 'build'], { cwd: worktree, env: { ...process.env, VITE_PN_MOCK_DICTIONARY: '1', VITE_PN_MOCK_BERGAMOT: '1', VITE_PN_MOCK_TTS: '1' } });
  const oldDist = join(worktree, 'dist');
  const server = serveDist(oldDist);
  const base = `http://127.0.0.1:${port}/`;
  run(
    'npx',
    [
      'playwright',
      'test',
      'e2e/release-upgrade.spec.ts',
      '--project=chromium-mobile',
      '--workers=1',
      '--retries=0',
    ],
    {
      cwd: testsDir,
      env: {
        ...process.env,
        PAGENEST_BASE_URL: base,
        PAGENEST_SKIP_BUILD: '1',
        PAGENEST_UPGRADE_PROFILE: profile,
        PAGENEST_UPGRADE_PHASE: 'import',
      },
    },
  );
  server.close();
  run('npm', ['run', 'build'], {
    cwd: repoRoot,
    env: { ...process.env, VITE_PN_MOCK_DICTIONARY: '1', VITE_PN_MOCK_BERGAMOT: '1', VITE_PN_MOCK_TTS: '1' },
  });
  const newServer = serveDist(join(repoRoot, 'dist'));
  run(
    'npx',
    [
      'playwright',
      'test',
      'e2e/release-upgrade.spec.ts',
      '--project=chromium-mobile',
      '--workers=1',
      '--retries=0',
    ],
    {
      cwd: testsDir,
      env: {
        ...process.env,
        PAGENEST_BASE_URL: base,
        PAGENEST_SKIP_BUILD: '1',
        PAGENEST_UPGRADE_PROFILE: profile,
        PAGENEST_UPGRADE_PHASE: 'verify',
      },
    },
  );
  newServer.close();
} finally {
  run('git', ['worktree', 'remove', '--force', worktree]);
  rmSync(profile, { recursive: true, force: true });
}

console.log('Upgrade smoke passed.');
