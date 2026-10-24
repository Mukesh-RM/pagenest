// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards for the "no lag" rules in docs/PERFORMANCE.md. They read the source, so a change that
 * breaks a rule fails here with the file name instead of showing up later as jank.
 */
const APP = join(process.cwd(), 'src', 'app');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const files = sources(APP).map((path) => ({ name: relative(process.cwd(), path), text: readFileSync(path, 'utf8') }));

describe('performance rules for src/app', () => {
  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('never subscribes to a whole Zustand store (always pass a selector)', () => {
    const offenders = files.filter((f) => /\buse[A-Z]\w*Store\(\s*\)|\buseSettings\(\s*\)/.test(f.text)).map((f) => f.name);
    expect(offenders).toEqual([]);
  });

  it('loads the four tabs and onboarding lazily, never with a static import', () => {
    const staticImport = /^import .* from '\.\/(pages\/\w+|onboarding\/Onboarding)';/m;
    const offenders = files.filter((f) => staticImport.test(f.text)).map((f) => f.name);
    expect(offenders).toEqual([]);
    const screens = files.find((f) => f.name.endsWith('screens.ts'))?.text ?? '';
    for (const page of ['LibraryPage', 'CollectionsPage', 'StatsPage', 'SettingsPage', 'onboarding/Onboarding']) {
      expect(screens).toContain(`import('./${page.includes('/') ? page : `pages/${page}`}')`);
    }
  });

  it('keeps the heavy demo out of the production bundle (dev-only import)', () => {
    const routes = files.find((f) => f.name.endsWith('routes.tsx'))?.text ?? '';
    expect(routes).toMatch(/import\.meta\.env\.DEV\s*\?\s*lazy\(/);
  });

  it('does no network access', () => {
    const offenders = files.filter((f) => /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/.test(f.text)).map((f) => f.name);
    expect(offenders).toEqual([]);
  });

  it('animates only with transform or opacity in app-owned CSS', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8') + readFileSync(join(APP, 'theme.css'), 'utf8');
    const transitions = [...css.matchAll(/transition(?:-property)?\s*:\s*([^;]+);/g)].map((m) => m[1] ?? '');
    for (const t of transitions) expect(t).not.toMatch(/\b(width|height|top|left|right|bottom|margin|padding|all)\b/);
  });
});
