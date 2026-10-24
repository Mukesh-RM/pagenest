// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Runs `scripts/check-bundle.mjs` (the same script `npm run build` ends with) against small
 * fake `dist` folders, so the budget check itself is tested without needing a real build.
 * Random bytes do not compress, so a file's gzip size is about its byte size.
 */
const SCRIPT = join(process.cwd(), 'scripts', 'check-bundle.mjs');
const dirs: string[] = [];

function makeDist(files: Record<string, number>, html: string): string {
  const dist = mkdtempSync(join(tmpdir(), 'pn-dist-'));
  dirs.push(dist);
  mkdirSync(join(dist, 'assets'));
  for (const [name, bytes] of Object.entries(files)) writeFileSync(join(dist, 'assets', name), randomBytes(bytes));
  writeFileSync(join(dist, 'index.html'), html);
  return dist;
}

const page = (extra = '') => `<!doctype html><html><head>
<script type="module" crossorigin src="/assets/index-abc.js"></script>${extra}
<link rel="stylesheet" crossorigin href="/assets/index-abc.css"></head><body></body></html>`;

function run(dist: string) {
  const r = spawnSync(process.execPath, [SCRIPT, dist], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('bundle budget script', () => {
  it('passes a small bundle', () => {
    const dist = makeDist({ 'index-abc.js': 50_000, 'index-abc.css': 4_000, 'Stats-1.js': 3_000 }, page());
    const { code, out } = run(dist);
    expect(out).toContain('ok   initial JS');
    expect(code).toBe(0);
  });

  it('fails when the first-load JavaScript is over budget', () => {
    const dist = makeDist({ 'index-abc.js': 130_000, 'index-abc.css': 1_000 }, page());
    const { code, out } = run(dist);
    expect(out).toMatch(/FAIL initial JS/);
    expect(code).toBe(1);
  });

  it('counts modulepreloaded chunks as first load', () => {
    const dist = makeDist(
      { 'index-abc.js': 70_000, 'vendor-1.js': 70_000, 'index-abc.css': 1_000 },
      page('<link rel="modulepreload" crossorigin href="/assets/vendor-1.js">'),
    );
    const { code, out } = run(dist);
    expect(out).toMatch(/FAIL initial JS/);
    expect(code).toBe(1);
  });

  it('fails when the first-load CSS is over budget', () => {
    const dist = makeDist({ 'index-abc.js': 10_000, 'index-abc.css': 15_000 }, page());
    expect(run(dist)).toMatchObject({ code: 1 });
  });

  it('fails when one lazy chunk is too big, but ignores lazy size for the first-load total', () => {
    const dist = makeDist({ 'index-abc.js': 10_000, 'index-abc.css': 1_000, 'Big-1.js': 50_000 }, page());
    const { code, out } = run(dist);
    expect(out).toMatch(/FAIL lazy chunk Big-1\.js/);
    expect(out).toContain('ok   initial JS');
    expect(code).toBe(1);
  });

  it('holds every worker, including the Library import worker, to the same 55 kB budget (no per-file exceptions)', () => {
    const fits = makeDist({ 'index-abc.js': 10_000, 'index-abc.css': 1_000, 'import.worker-1.js': 54_000 }, page());
    expect(run(fits)).toMatchObject({ code: 0 });
    const over = makeDist({ 'index-abc.js': 10_000, 'index-abc.css': 1_000, 'import.worker-1.js': 58_000 }, page());
    expect(run(over).out).toMatch(/FAIL worker chunk import\.worker-1\.js/);
    expect(readFileSync(SCRIPT, 'utf8')).not.toMatch(/WORKER_OVERRIDES/);
  });

  it('gives a Web Worker chunk more room than a screen (it carries its own Dexie), but not unlimited', () => {
    const fits = makeDist({ 'index-abc.js': 10_000, 'index-abc.css': 1_000, 'data.worker-1.js': 48_000 }, page());
    const ok = run(fits);
    expect(ok.out).toContain('ok   worker chunk data.worker-1.js');
    expect(ok.code).toBe(0);
    const tooBig = makeDist({ 'index-abc.js': 10_000, 'index-abc.css': 1_000, 'data.worker-1.js': 60_000 }, page());
    const bad = run(tooBig);
    expect(bad.out).toMatch(/FAIL worker chunk data\.worker-1\.js/);
    expect(bad.code).toBe(1);
  });

  it('fails clearly when there is no build', () => {
    const dist = mkdtempSync(join(tmpdir(), 'pn-empty-'));
    dirs.push(dist);
    const { code, out } = run(dist);
    expect(out).toContain('Run the build first');
    expect(code).toBe(1);
  });

  it('fails when index.html points at a missing file', () => {
    const dist = makeDist({ 'index-abc.css': 1_000 }, page());
    const { code, out } = run(dist);
    expect(out).toContain('missing files');
    expect(code).toBe(1);
  });
});
