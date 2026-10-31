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
// Enough of a glob for these patterns: `**/` is any folder prefix, `*` is anything inside one name.
const minimatchLike = (glob: string, path: string): boolean =>
  new RegExp(
    `^${glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*\//g, '(?:.*/)?')
      .replace(/\*/g, '[^/]*')}$`,
  ).test(path);

const list = (name: string): string[] => {
  const body = new RegExp(`${name}:\\s*\\[([^\\]]*)\\]`).exec(config)?.[1] ?? '';
  return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1] as string);
};

describe('service worker precache configuration (vite.config.ts)', () => {
  it('precaches JavaScript, so the import worker and parser chunks work offline', () => {
    expect(list('globPatterns').some((g) => /\*\.\{[^}]*\bjs\b/.test(g))).toBe(true);
  });

  it('does not ignore the import worker, the data worker or the parser chunks, and never ignores JavaScript as a whole', () => {
    const ENGINE_IGNORES = [
      '**/assets/engine-*.js',
      '**/assets/docx-core-*.js',
      '**/assets/docx.worker-*.js',
      '**/assets/piper.worker-*.js',
      '**/assets/clone.worker-*.js',
      '**/assets/engine-tts-*.js',
      '**/assets/pdf.worker*.mjs',
    ];
    for (const ignore of list('globIgnores').filter((g) => !ENGINE_IGNORES.includes(g))) {
      expect(ignore).not.toMatch(/worker|Parser|\.js\b/i);
    }
    // The sample must still cover what import needs offline: nothing ignored matches these names.
    for (const name of [
      'assets/import.worker-abc.js',
      'assets/data.worker-abc.js',
      'assets/AsfParser-abc.js',
      'assets/audio-metadata.worker-abc.js',
      'assets/index-abc.js',
    ]) {
      for (const ignore of list('globIgnores')) expect(minimatchLike(ignore, name), `${ignore} vs ${name}`).toBe(false);
    }
  });

  it('Decision 15: the Reader engines (pdf.js, foliate, docx and their workers) are not precached; they are cached at runtime', () => {
    for (const name of [
      'assets/engine-pdf-abc.js',
      'assets/engine-foliate-abc.js',
      'assets/docx-core-abc.js',
      'assets/docx.worker-abc.js',
      'assets/pdf.worker.min-abc.mjs',
    ]) {
      expect(
        list('globIgnores').some((ignore) => minimatchLike(ignore, name)),
        name,
      ).toBe(true);
    }
    expect(list('globPatterns').some((g) => /mjs/.test(g))).toBe(false);
  });

  it('names the engine chunks the way scripts/check-bundle.mjs and the precache rules expect', () => {
    expect(config).toContain("return 'engine-pdf'");
    expect(config).toContain("return 'engine-foliate'");
    const script = readFileSync(join(process.cwd(), 'scripts', 'check-bundle.mjs'), 'utf8');
    expect(script).toContain('/^engine-pdf-/');
    expect(script).toContain('/^engine-foliate-/');
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
