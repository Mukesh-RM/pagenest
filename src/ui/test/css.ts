/// <reference types="node" />
/**
 * Test helpers that read the design system's REAL source files from disk, so tests check what
 * ships. (Vitest runs with `css: false`, which empties CSS imports, hence plain file reads;
 * the triple-slash line brings in Node typings for these test files only.)
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const UI_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Source text of a file under src/ui, for example `styles/tokens.css`. */
export function readUiFile(relative: string): string {
  return readFileSync(join(UI_DIR, relative), 'utf8');
}

/** True when a file (including fonts) exists under src/ui. `relative` may contain "..". */
export function uiFileExists(relative: string): boolean {
  return existsSync(normalize(join(UI_DIR, relative)));
}

/** All files under src/ui, relative to src/ui with forward slashes. */
export function listUiFiles(dir = UI_DIR): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listUiFiles(full);
    return [full.slice(UI_DIR.length + 1).split(sep).join('/')];
  });
}

/** "62 91 219" to "#3e5bdb". */
export function tripletToHex(triplet: string): string {
  const parts = triplet.trim().split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new Error(`Not an RGB triplet: "${triplet}"`);
  }
  return '#' + parts.map((n) => n.toString(16).padStart(2, '0')).join('');
}

export interface CssRule {
  /** Enclosing at-rule prelude such as "@media (min-width: 768px)", or "" at top level. */
  at: string;
  /** One selector from a comma separated list. */
  selector: string;
  declarations: Record<string, string>;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseDeclarations(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  // Split on ";" outside parentheses (url(), rgb(), color-mix() contain no ";" but keep it safe).
  let depth = 0;
  let current = '';
  const parts: string[] = [];
  for (const ch of body) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ';' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  parts.push(current);
  for (const part of parts) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim().replace(/\s+/g, ' ');
    if (name) out[name] = value;
  }
  return out;
}

/** Minimal CSS parser: flat rules and one level of at-rule nesting (@media, @keyframes skipped). */
export function parseCss(source: string): CssRule[] {
  const css = stripComments(source);
  const rules: CssRule[] = [];

  const walk = (text: string, at: string): void => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      const prelude = text.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth += 1;
        if (text[j] === '}') depth -= 1;
        j += 1;
      }
      const inner = text.slice(open + 1, j - 1);
      if (prelude.startsWith('@')) {
        if (prelude.startsWith('@media') || prelude.startsWith('@supports')) walk(inner, prelude);
        // @font-face and @keyframes are not selector rules; skip.
      } else if (prelude) {
        const declarations = parseDeclarations(inner);
        for (const selector of prelude.split(',')) {
          rules.push({ at, selector: selector.trim().replace(/\s+/g, ' '), declarations });
        }
      }
      i = j;
    }
  };

  walk(css, '');
  return rules;
}

/** Merge declarations of every top-level rule for `selector`. */
export function declarationsFor(rules: CssRule[], selector: string, at = ''): Record<string, string> {
  return Object.assign({}, ...rules.filter((r) => r.selector === selector && r.at === at).map((r) => r.declarations));
}
