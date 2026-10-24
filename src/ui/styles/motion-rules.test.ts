/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listUiFiles, parseCss, readUiFile } from '../test/css';

/**
 * Motion rule (blueprint 5.7 and the performance budget): anything that CSS animates or transitions may only change
 * `transform` and `opacity` (plus the individual transform properties `translate`, `scale` and `rotate`). Those run on the
 * compositor, so a sheet or a card moving never triggers layout or paint on the main thread and never drops a frame
 * while a book is importing. Colors, borders, shadows, sizes and positions change INSTANTLY; they are state changes,
 * not motion.
 *
 * Allow-list: if a property truly has to animate, add one entry below with the file, the exact selector (or
 * `@keyframes name`), the property and the reason, and say what the cost is. Every entry must still match something
 * in the CSS (stale entries fail), so the list cannot silently grow or rot. Today it is empty on purpose.
 */
export interface MotionAllowance {
  file: string;
  /** The selector as written, or `@keyframes <name>`. */
  where: string;
  property: string;
  reason: string;
}
export const MOTION_ALLOW_LIST: readonly MotionAllowance[] = [];

export const COMPOSITOR_PROPERTIES: ReadonlySet<string> = new Set(['transform', 'opacity', 'translate', 'scale', 'rotate']);

/** Keyframe declarations that are not animated values. */
const KEYFRAME_META = new Set(['animation-timing-function', 'animation-composition']);

const TIME = /^-?[\d.]+m?s$/;
const EASING = /^(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|steps\(.*\)|cubic-bezier\(.*\)|linear\(.*\))$/;
const KEYWORD = /^(normal|allow-discrete|none)$/;

function splitTop(value: string, sep: ',' | ' '): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (depth === 0 && (sep === ' ' ? /\s/.test(ch) : ch === sep)) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** The property names a `transition` shorthand or `transition-property` value animates. `all` is returned as "all". */
export function transitionedProperties(declaration: string, value: string): string[] {
  const v = value.trim();
  if (declaration === 'transition-property') return splitTop(v, ',').filter((p) => p !== 'none');
  const out: string[] = [];
  for (const part of splitTop(v, ',')) {
    if (part === 'none') continue;
    const tokens = splitTop(part, ' ');
    const prop = tokens.find((t) => !TIME.test(t) && !EASING.test(t) && !KEYWORD.test(t) && !t.startsWith('var('));
    // A shorthand with only a duration (`transition: 200ms`) animates `all`.
    out.push(prop ?? 'all');
  }
  return out;
}

export interface MotionViolation {
  file: string;
  where: string;
  property: string;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Every transition and keyframe in `source` that touches a property outside the compositor set. */
export function findMotionViolations(file: string, source: string): MotionViolation[] {
  const found: MotionViolation[] = [];
  for (const rule of parseCss(source)) {
    for (const [name, value] of Object.entries(rule.declarations)) {
      if (name !== 'transition' && name !== 'transition-property') continue;
      for (const property of transitionedProperties(name, value)) {
        if (!COMPOSITOR_PROPERTIES.has(property)) found.push({ file, where: rule.selector, property });
      }
    }
  }
  const css = stripComments(source);
  for (const m of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    let depth = 1;
    let i = (m.index ?? 0) + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      if (css[i] === '}') depth -= 1;
      i += 1;
    }
    const body = css.slice(start, i - 1);
    for (const block of body.matchAll(/[^{}]+\{([^}]*)\}/g)) {
      for (const decl of block[1]!.split(';')) {
        const name = decl.split(':')[0]?.trim();
        if (name && !KEYFRAME_META.has(name) && !COMPOSITOR_PROPERTIES.has(name)) found.push({ file, where: `@keyframes ${m[1]}`, property: name });
      }
    }
  }
  return found;
}

const cssFiles = listUiFiles().filter((f) => f.endsWith('.css'));
const allowed = (v: MotionViolation) => MOTION_ALLOW_LIST.some((a) => a.file === v.file && a.where === v.where && a.property === v.property);

describe('motion rule: CSS transitions and animations only touch transform and opacity', () => {
  it('scans the real stylesheets', () => {
    expect(cssFiles).toEqual(expect.arrayContaining(['styles/components.css', 'styles/screens.css', 'styles/shell.css']));
  });

  it('no transition or keyframe animates anything else (colors, borders, shadows, sizes swap instantly)', () => {
    const violations = cssFiles.flatMap((f) => findMotionViolations(f, readUiFile(f))).filter((v) => !allowed(v));
    expect(
      violations.map((v) => `${v.file}: ${v.where} animates "${v.property}"`),
      'Only transform and opacity may animate. Remove the transition, or add a documented MOTION_ALLOW_LIST entry.',
    ).toEqual([]);
  });

  it('never uses `transition: all` or a bare duration', () => {
    for (const f of cssFiles) {
      for (const rule of parseCss(readUiFile(f))) {
        for (const [name, value] of Object.entries(rule.declarations)) {
          if (name !== 'transition' && name !== 'transition-property') continue;
          expect(transitionedProperties(name, value), `${f} ${rule.selector}`).not.toContain('all');
        }
      }
    }
  });

  it('every allow-list entry has a reason and still matches something', () => {
    const all = cssFiles.flatMap((f) => findMotionViolations(f, readUiFile(f)));
    for (const a of MOTION_ALLOW_LIST) {
      expect(a.reason.trim().length, `${a.file} ${a.where}`).toBeGreaterThan(15);
      expect(all.some((v) => v.file === a.file && v.where === a.where && v.property === a.property), `stale: ${a.file} ${a.where} ${a.property}`).toBe(true);
    }
  });

  it('will-change is only used for transform and opacity', () => {
    for (const f of cssFiles) {
      for (const rule of parseCss(readUiFile(f))) {
        const value = rule.declarations['will-change'];
        if (value) expect(['transform', 'opacity', 'auto', 'transform, opacity'], `${f} ${rule.selector}`).toContain(value);
      }
    }
  });
});

/** All .css files under src (outside src/ui), so the rule holds for the whole app, not only the design system. */
function appCss(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'ui' || name === 'node_modules' ? [] : appCss(full);
    return full.endsWith('.css') ? [full] : [];
  });
}

describe('motion rule: the rest of src follows it too', () => {
  it('app and feature stylesheets only animate transform and opacity', () => {
    const root = join(process.cwd(), 'src');
    const files = appCss(root);
    const violations = files.flatMap((f) => findMotionViolations(f.slice(root.length + 1), readFileSync(f, 'utf8')));
    expect(violations.map((v) => `${v.file}: ${v.where} animates "${v.property}"`)).toEqual([]);
  });
});

describe('the lint itself', () => {
  it('flags the properties it should', () => {
    const css = `
      .a { transition: transform 200ms ease-out, opacity var(--d) var(--e); }
      .b { transition: background-color 200ms; }
      .c { transition: border-color var(--d) cubic-bezier(0.2, 0, 0, 1), transform 1s; }
      .d { transition-property: opacity, height; }
      .e { transition: all 1s; }
      .f { transition: none; }
      .g { transition: 200ms; }
      @keyframes k { from { opacity: 0; transform: none; } to { opacity: 1; height: 10px; } }
      @keyframes ok { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
      @media (min-width: 600px) { .h { transition: color 1s; } }
    `;
    expect(findMotionViolations('x.css', css).map((v) => `${v.where}|${v.property}`)).toEqual([
      '.b|background-color',
      '.c|border-color',
      '.d|height',
      '.e|all',
      '.g|all',
      '.h|color',
      '@keyframes k|height',
    ]);
  });
});
