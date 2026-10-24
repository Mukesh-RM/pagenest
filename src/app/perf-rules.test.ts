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
    for (const page of ['LibraryRoute', 'CollectionsPage', 'StatsPage', 'SettingsPage', 'onboarding/Onboarding']) {
      expect(screens).toContain(`import('./${page.includes('/') ? page : `pages/${page}`}')`);
    }
  });

  it("loads the screens' stylesheets with every lazy route, and never from first-paint code", () => {
    const routes = [
      'pages/LibraryRoute',
      'pages/CollectionsPage',
      'pages/StatsPage',
      'pages/SettingsPage',
      'pages/ReaderScreen',
      'pages/PlayerScreen',
      'pages/BookRoute',
      'onboarding/Onboarding',
    ];
    for (const route of routes) {
      const file = files.find((f) => f.name.endsWith(`${route}.tsx`));
      expect(file?.text, route).toMatch(/^import '\.\.\/screen-styles';$/m);
    }
    const importers = files
      .filter((f) => /^import '(\.\.?\/)+screen-styles';$/m.test(f.text))
      .map((f) => f.name.replace(/^src\/app\//, '').replace(/\.tsx$/, ''));
    expect(importers.sort()).toEqual([...routes].sort());
  });

  it("registers the Library through '@/features/library/provider' (no screens, no CSS); only the lazy routes (and the lazy Settings panels) import the screens barrel", () => {
    const barrel = /from '@\/features\/library';/;
    const offenders = files.filter((f) => barrel.test(f.text) && !/(pages\/LibraryRoute|pages\/CollectionsPage|components\/LibrarySettingsPanels)\.tsx$/.test(f.name)).map((f) => f.name);
    expect(offenders).toEqual([]);
    const services = files.find((f) => f.name.endsWith('src/app/services.tsx'))?.text ?? '';
    expect(services).toContain("from '@/features/library/provider'");
  });

  it('keeps overlays (PWA prompts) out of the first-paint chunk: only dynamic imports', () => {
    const lazyWrappers = /Lazy(PwaPrompts)\.tsx$/;
    const offenders = files
      .filter((f) => !lazyWrappers.test(f.name))
      .filter((f) => f.text.split('\n').some((line) => /^import (?!type)/.test(line) && /from '[^']*\/(PwaPromptsHost)';/.test(line)))
      .map((f) => f.name);
    expect(offenders).toEqual([]);
  });

  it('does not load the file-store code (OPFS) on first paint', () => {
    const client = readFileSync(join(process.cwd(), 'src', 'data', 'data-client.ts'), 'utf8');
    expect(client).not.toMatch(/^import \{[^}]*createFileStore[^}]*\} from '\.\/opfs'/m);
    expect(client).toContain("import('./opfs')");
  });

  it('keeps the heavy demo out of the production bundle (dev-only import)', () => {
    const routes = files.find((f) => f.name.endsWith('routes.tsx'))?.text ?? '';
    expect(routes).toMatch(/import\.meta\.env\.DEV\s*\?\s*lazy\(/);
  });

  it('does no network access, except the one same-origin warm-up of our own assets (Decision 15)', () => {
    const offenders = files.filter((f) => /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/.test(f.text)).map((f) => f.name);
    expect(offenders).toEqual(['src/app/offline-assets.ts']);
    const warm = files.find((f) => f.name === 'src/app/offline-assets.ts')?.text ?? '';
    expect(warm).toMatch(/fetch\(sampleUrl, \{ credentials: 'same-origin' \}\)/); // a bundled asset URL, never a literal address
    expect(warm).not.toMatch(/https?:\/\//);
    // and it is only ever loaded lazily, after the Library is drawn
    expect(files.filter((f) => /from '\.\/offline-assets'|from '\.\.\/offline-assets'/.test(f.text)).map((f) => f.name)).toEqual([]);
  });

  it('animates only with transform or opacity in app-owned CSS', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8') + readFileSync(join(APP, 'theme.css'), 'utf8');
    const transitions = [...css.matchAll(/transition(?:-property)?\s*:\s*([^;]+);/g)].map((m) => m[1] ?? '');
    for (const t of transitions) expect(t).not.toMatch(/\b(width|height|top|left|right|bottom|margin|padding|all)\b/);
  });
});

describe('motion preferences', () => {
  it('turns animations and transitions off for prefers-reduced-motion, for every element', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?\n\s*)\}\s*\n/.exec(css)?.[1] ?? '';
    expect(block).toMatch(/\*,\s*\*::before,\s*\*::after/);
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });
});
