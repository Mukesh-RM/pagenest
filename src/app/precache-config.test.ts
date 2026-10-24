// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Casey's precache decision: importing books must work offline, so the Library's import worker,
 * the audio tag worker and the lazy parser chunks stay in the service worker precache. The sample
 * EPUB (1.5 MB) must never be precached: it is fetched only when a person taps the sample card.
 */
const config = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8');
const list = (name: string): string[] => {
  const body = new RegExp(`${name}:\\s*\\[([^\\]]*)\\]`).exec(config)?.[1] ?? '';
  return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1] as string);
};

describe('service worker precache configuration (vite.config.ts)', () => {
  it('precaches JavaScript, so the import worker and parser chunks work offline', () => {
    expect(list('globPatterns').some((g) => /\*\.\{[^}]*\bjs\b/.test(g))).toBe(true);
  });

  it('does not ignore workers or parser chunks', () => {
    for (const ignore of list('globIgnores')) {
      expect(ignore).not.toMatch(/worker|Parser|\.js\b/i);
    }
  });

  it('never lists an EPUB (or any book file) for precaching', () => {
    for (const pattern of list('globPatterns')) expect(pattern).not.toMatch(/epub|pdf|mp3|m4b/i);
  });

  it('keeps big files out through the size cap as well (1 MB), so a stray asset cannot sneak in', () => {
    expect(config).toMatch(/maximumFileSizeToCacheInBytes:\s*1024\s*\*\s*1024/);
  });

  it('builds ES-module workers (the Library workers use dynamic import and nested workers)', () => {
    expect(config).toMatch(/worker:\s*\{\s*format:\s*'es'\s*\}/);
  });

  it('splits react-dom, dexie and the router into their own chunks, so the entry does not evaluate as one long task', () => {
    for (const name of ['react-dom', 'dexie', 'router']) expect(config).toContain(`return '${name}'`);
  });
});
