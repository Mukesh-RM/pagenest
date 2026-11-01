#!/usr/bin/env node
/**
 * Upgrade smoke: import on build A, rebuild to build B (new asset hashes), same browser profile — books must still open.
 */
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const testsDir = join(repoRoot, 'tests');
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

function listenDist(dist) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const { pathname } = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
      let file = resolve(join(dist, pathname));
      if (!file.startsWith(dist + sep) || !existsSync(file) || statSync(file).isDirectory()) {
        file = join(dist, 'index.html');
      }
      const body = readFileSync(file);
      res.writeHead(200, {
        'Content-Type': types[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(body);
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

const profile = mkdtempSync(join(tmpdir(), 'pagenest-upgrade-profile-'));
const buildEnv = {
  ...process.env,
  VITE_PN_MOCK_DICTIONARY: '1',
  VITE_PN_MOCK_BERGAMOT: '1',
  VITE_PN_MOCK_TTS: '1',
};
const dist = join(repoRoot, 'dist');
const base = `http://127.0.0.1:${port}/`;

try {
  if (!existsSync(join(dist, 'index.html'))) {
    run('npm', ['run', 'build'], { env: buildEnv });
  }
  const serverA = await listenDist(dist);
  run(
    'npx',
    ['playwright', 'test', 'e2e/release-upgrade.spec.ts', '--project=release-upgrade', '--workers=1', '--retries=0'],
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
  await new Promise((r) => serverA.close(r));

  // Force a new production bundle (new filenames / SW precache) like a deploy.
  utimesSync(join(repoRoot, 'index.html'), new Date(), new Date());
  run('npm', ['run', 'build'], { env: buildEnv });

  const serverB = await listenDist(dist);
  run(
    'npx',
    ['playwright', 'test', 'e2e/release-upgrade.spec.ts', '--project=release-upgrade', '--workers=1', '--retries=0'],
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
  await new Promise((r) => serverB.close(r));
} finally {
  rmSync(profile, { recursive: true, force: true });
}

console.log('Upgrade smoke passed.');
