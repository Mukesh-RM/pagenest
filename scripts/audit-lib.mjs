// Shared helpers for the InkQuiet audit scripts (scripts/audit-*). Dependency-free.
// Owner: Auditor. Do not import from product code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));

/** True when the module is the entry point (so tests can import without running main). */
export function isMain(metaUrl) {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(fs.realpathSync(process.argv[1])).href === metaUrl;
  } catch {
    return false;
  }
}

/**
 * Tiny argument parser. spec: { flagName: 'bool' | 'string' | 'list' }.
 * Supports --flag, --flag=value, --flag value. Unknown flags throw.
 */
export function parseArgs(argv, spec) {
  const out = { _: [] };
  for (const [k, t] of Object.entries(spec)) out[camel(k)] = t === 'bool' ? false : t === 'list' ? [] : undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    let [name, val] = a.slice(2).split(/=(.*)/s, 2);
    const t = spec[name];
    if (!t) throw new Error(`Unknown option --${name}`);
    if (t === 'bool') {
      out[camel(name)] = true;
      continue;
    }
    if (val === undefined) {
      val = argv[++i];
      if (val === undefined) throw new Error(`Option --${name} needs a value`);
    }
    if (t === 'list') out[camel(name)].push(val);
    else out[camel(name)] = val;
  }
  return out;
}
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

export function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

export function readJson(file) {
  const t = readText(file);
  if (t === null) return null;
  try {
    return JSON.parse(t);
  } catch (e) {
    throw new Error(`Invalid JSON in ${file}: ${e.message}`);
  }
}

export function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

export function lineOfIndex(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** Build a fast index->line function for one text. */
export function makeLineFinder(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return (index) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

export function relPath(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

/** Recursively list files under `start` (a file or directory). */
export function walk(start, { skipDirs = new Set(['node_modules', '.git', 'dist', 'coverage']) } = {}) {
  const files = [];
  const visit = (p) => {
    let st;
    try {
      st = fs.lstatSync(p);
    } catch {
      return;
    }
    if (st.isSymbolicLink()) return;
    if (st.isDirectory()) {
      if (skipDirs.has(path.basename(p))) return;
      for (const name of fs.readdirSync(p).sort()) visit(path.join(p, name));
    } else if (st.isFile()) files.push(p);
  };
  visit(start);
  return files;
}

export function looksBinary(buf) {
  const n = Math.min(buf.length, 4096);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

export function git(root, args, opts = {}) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024, ...opts });
}

export function isGitRepo(root) {
  const r = git(root, ['rev-parse', '--is-inside-work-tree']);
  return r.status === 0 && r.stdout.trim() === 'true';
}

export function truncate(s, n = 160) {
  const t = s.trim().replace(/\s+/g, ' ');
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

export function escapeMd(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/** Marker that silences one finding. A reason is mandatory: `audit-ignore: <reason>`. */
export const IGNORE_RE = /audit-ignore:\s*\S+/;
