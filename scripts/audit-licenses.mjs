#!/usr/bin/env node
// PageNest license audit. Dependency-free, offline by default.
//
//   node scripts/audit-licenses.mjs            audit and print a report
//   node scripts/audit-licenses.mjs --write    also regenerate docs/LICENSES.md
//   node scripts/audit-licenses.mjs --check    fail if docs/LICENSES.md is out of date
//   node scripts/audit-licenses.mjs --json     machine readable result
//   node scripts/audit-licenses.mjs --registry look up unknown licenses on registry.npmjs.org (network)
//   node scripts/audit-licenses.mjs --root DIR audit another project folder
//
// Exit code 1 when an installed package has a license that is not on the allow-list
// (GPL, AGPL, LGPL, SSPL, CC-NC, unknown, UNLICENSED, ...). Planned assets from
// scripts/audit-planned.json are listed as open risks but never change the exit code.
// Owner: Auditor.
import fs from 'node:fs';
import path from 'node:path';
import { SCRIPTS_DIR, escapeMd, exists, isMain, parseArgs, readJson, readText, relPath } from './audit-lib.mjs';

// ---------------------------------------------------------------- policy

/** Allowed SPDX ids (case-insensitive lookup). value: note shown in the report, or null. */
const ALLOWED = {
  'MIT': null,
  'MIT-0': null,
  'Apache-2.0': null,
  'BSD-2-Clause': null,
  'BSD-3-Clause': null,
  'ISC': null,
  'OFL-1.1': 'SIL Open Font License: ship license text and copyright with the font files; do not sell the font alone.',
  'CC0-1.0': null,
  '0BSD': null,
  'Unlicense': null,
  'Zlib': null,
  'BlueOak-1.0.0': null,
  'Python-2.0': null,
  'MPL-2.0': 'Weak copyleft (file level): changes to MPL files must be shared; allowed unmodified.',
  'CC-BY-4.0': 'Attribution required: list author and license in the app licenses screen.',
  'CC-BY-3.0': 'Attribution required: list author and license in the app licenses screen.',
  'BSD': 'Ambiguous "BSD" declaration: confirm it is the 2- or 3-clause text (not the 4-clause advertising version).',
  'Public Domain': 'Declared public domain (not an SPDX id): confirm in the LICENSE file.',
};
const ALLOWED_LC = new Map(Object.entries(ALLOWED).map(([k, v]) => [k.toLowerCase(), [k, v]]));

/** Common non-SPDX spellings seen in package.json files. */
const ALIASES = {
  'apache 2.0': 'Apache-2.0',
  'apache-2': 'Apache-2.0',
  'apache2': 'Apache-2.0',
  'apache license 2.0': 'Apache-2.0',
  'apache license, version 2.0': 'Apache-2.0',
  'apache software license': 'Apache-2.0',
  'the apache license, version 2.0': 'Apache-2.0',
  'the mit license': 'MIT',
  'mit license': 'MIT',
  'mit*': 'MIT',
  'expat': 'MIT',
  'bsd-2': 'BSD-2-Clause',
  'bsd 2-clause': 'BSD-2-Clause',
  'bsd-3': 'BSD-3-Clause',
  'bsd 3-clause': 'BSD-3-Clause',
  'bsd-3-clause license': 'BSD-3-Clause',
  'new bsd': 'BSD-3-Clause',
  'simplified bsd': 'BSD-2-Clause',
  'isc license': 'ISC',
  'sil open font license 1.1': 'OFL-1.1',
  'ofl': 'OFL-1.1',
  'cc0': 'CC0-1.0',
  'cc-by': 'CC-BY-4.0',
  'public domain': 'Public Domain',
  'unlicensed': 'UNLICENSED',
};

/** Package names whose declared license hides copyleft code (GPL eSpeak NG compiled to WASM, etc.). */
const HIDDEN_COPYLEFT = [
  /^phonemizer$/i,
  /^espeak/i,
  /espeak-?ng/i,
  /^mespeak$/i,
  /^piper-wasm$/i,
  /piper-wasm$/i,
  /^piper-phonemize/i,
  /piper-tts-web$/i,
  /^onnx-?phonemizer/i,
];

const DENY_LABELS = [
  [/^AGPL/i, 'AGPL (network copyleft)'],
  [/^LGPL/i, 'LGPL (copyleft)'],
  [/^GPL/i, 'GPL (copyleft)'],
  [/^SSPL/i, 'SSPL (not open source)'],
  [/^CC-BY-NC|NONCOMMERCIAL|NON-COMMERCIAL/i, 'non-commercial license'],
  [/^CC-BY-ND/i, 'no-derivatives license'],
  [/^CC-BY-SA/i, 'share-alike license'],
  [/^EUPL|^OSL|^CPAL|^RPL|^Sleepycat|^BUSL|^Elastic|^Commons-Clause|^Polyform/i, 'restricted or reciprocal license'],
  [/^UNLICENSED$|^UNLICENSE$/i, 'UNLICENSED (all rights reserved)'],
  [/^SEE LICENSE|^CUSTOM|^PROPRIETARY|^COMMERCIAL/i, 'custom or proprietary license'],
];

const RANK = { ok: 0, note: 1, violation: 2 };

export function classifyId(rawId) {
  let id = String(rawId).trim();
  if (!id) return { status: 'violation', reason: 'unknown (empty)', licenses: [''] };
  const aliased = ALIASES[id.toLowerCase()];
  if (aliased) id = aliased;
  const plus = id.replace(/\+$/, '');
  const hit = ALLOWED_LC.get(id.toLowerCase());
  if (hit) {
    const [canon, note] = hit;
    return { status: note ? 'note' : 'ok', reason: note || '', licenses: [canon] };
  }
  for (const [re, label] of DENY_LABELS) if (re.test(plus)) return { status: 'violation', reason: label, licenses: [id] };
  return { status: 'violation', reason: `unknown or not allow-listed license "${id}"`, licenses: [id] };
}

/** Tokenizer + recursive-descent parser for SPDX expressions (AND/OR/WITH/parentheses). */
function parseSpdx(expr) {
  const tokens = expr.match(/\(|\)|[^\s()]+/g) || [];
  let i = 0;
  const peekOp = () => (tokens[i] || '').toUpperCase();
  function parseOr() {
    let left = parseAnd();
    while (peekOp() === 'OR') {
      i++;
      left = { op: 'OR', left, right: parseAnd() };
    }
    return left;
  }
  function parseAnd() {
    let left = parseAtom();
    while (peekOp() === 'AND') {
      i++;
      left = { op: 'AND', left, right: parseAtom() };
    }
    return left;
  }
  function parseAtom() {
    const t = tokens[i];
    if (t === undefined) throw new Error('unexpected end');
    if (t === '(') {
      i++;
      const n = parseOr();
      if (tokens[i] !== ')') throw new Error('missing )');
      i++;
      return n;
    }
    if (t === ')' || ['AND', 'OR', 'WITH'].includes(t.toUpperCase())) throw new Error(`unexpected ${t}`);
    i++;
    let id = t;
    if (peekOp() === 'WITH') {
      i++;
      const exc = tokens[i++];
      if (!exc) throw new Error('missing exception');
      return { id, exception: exc };
    }
    return { id };
  }
  const tree = parseOr();
  if (i !== tokens.length) throw new Error(`unexpected ${tokens[i]}`);
  return tree;
}

function evalNode(n) {
  if (n.id !== undefined) {
    const r = classifyId(n.id);
    if (n.exception) {
      const exc = `${n.id} WITH ${n.exception}`;
      if (r.status === 'violation') return { ...r, licenses: [exc] };
      return { status: 'note', reason: `${r.reason ? `${r.reason} ` : ''}Exception clause "${n.exception}": confirm it only loosens terms.`.trim(), licenses: [exc] };
    }
    return r;
  }
  const l = evalNode(n.left);
  const r = evalNode(n.right);
  const licenses = [...l.licenses, ...r.licenses];
  if (n.op === 'OR') {
    // At least one allowed choice is enough: take the best (lowest rank) side.
    const best = RANK[l.status] <= RANK[r.status] ? l : r;
    const other = best === l ? r : l;
    if (best.status === 'violation') return { status: 'violation', reason: [l.reason, r.reason].filter(Boolean).join('; '), licenses };
    const dualNote = other.status === 'violation' ? `Dual licensed; used under ${best.licenses.join(' AND ')}, not ${other.licenses.join(' AND ')}.` : '';
    return { status: best.status, reason: joinNote(best.reason, dualNote), licenses };
  }
  // AND: all parts must be allowed.
  const worst = RANK[l.status] >= RANK[r.status] ? l : r;
  const reason = worst.status === 'violation' ? [l, r].filter((x) => x.status === 'violation').map((x) => x.reason).join('; ') : [l.reason, r.reason].filter(Boolean).join(' ');
  return { status: worst.status, reason, licenses };
}
const joinNote = (a, b) => [a, b].filter(Boolean).join(' ');

/** Evaluate a license string (SPDX expression or legacy text). */
export function evaluateLicense(input) {
  if (input === undefined || input === null || String(input).trim() === '') {
    return { status: 'violation', reason: 'unknown (no license declared)', licenses: [] };
  }
  const text = String(input).trim();
  const alias = ALIASES[text.toLowerCase()];
  if (alias) return classifyId(alias);
  try {
    return evalNode(parseSpdx(text));
  } catch {
    return classifyId(text);
  }
}

/** Normalise the many shapes of package.json "license"/"licenses". */
export function declaredLicense(pkg) {
  if (!pkg) return undefined;
  const l = pkg.license;
  if (typeof l === 'string' && l.trim()) return l.trim();
  if (l && typeof l === 'object' && typeof l.type === 'string') return l.type;
  if (Array.isArray(pkg.licenses) && pkg.licenses.length) {
    const parts = pkg.licenses.map((x) => (typeof x === 'string' ? x : x && x.type)).filter(Boolean);
    if (parts.length) return parts.length === 1 ? parts[0] : `(${parts.join(' OR ')})`;
  }
  return undefined;
}

/** Guess an SPDX id from LICENSE file text. Returns undefined when unsure. */
export function detectLicenseText(text) {
  if (!text) return undefined;
  const t = text.slice(0, 20000);
  if (/GNU AFFERO GENERAL PUBLIC LICENSE/i.test(t)) return 'AGPL-3.0-only';
  if (/GNU LESSER GENERAL PUBLIC LICENSE/i.test(t)) return 'LGPL-3.0-only';
  if (/GNU GENERAL PUBLIC LICENSE/i.test(t)) return 'GPL-3.0-only';
  if (/Server Side Public License/i.test(t)) return 'SSPL-1.0';
  if (/Apache License\s+Version 2\.0/i.test(t)) return 'Apache-2.0';
  if (/Mozilla Public License,? (Version|v\.?) ?2\.0/i.test(t)) return 'MPL-2.0';
  if (/SIL OPEN FONT LICENSE/i.test(t)) return 'OFL-1.1';
  if (/Creative Commons Zero|CC0 1\.0/i.test(t)) return 'CC0-1.0';
  if (/This is free and unencumbered software released into the public domain/i.test(t)) return 'Unlicense';
  if (/Permission is hereby granted, free of charge, to any person obtaining a copy/i.test(t)) return 'MIT';
  if (/Permission to use, copy, modify, and\/or distribute this software for any purpose with or without fee/i.test(t)) return /ISC/i.test(t) ? 'ISC' : '0BSD';
  if (/Redistribution and use in source and binary forms/i.test(t)) return /Neither the name|may be used to endorse/i.test(t) ? 'BSD-3-Clause' : 'BSD-2-Clause';
  return undefined;
}

const needsDetect = (license) => !license || /^(SEE LICENSE|UNKNOWN|CUSTOM)/i.test(license);

function findLicenseFile(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const f = names.find((n) => /^(licen[sc]e|copying|unlicense)(\.(md|txt|markdown))?$/i.test(n));
  return f ? path.join(dir, f) : null;
}

// ---------------------------------------------------------------- collecting packages

/** @returns {{name,version,scope,license,source,dir?,viaLockfile?}[]} */
export function collectPackages(root) {
  const pkgJsonPath = path.join(root, 'package.json');
  const rootPkg = readJson(pkgJsonPath);
  if (!rootPkg) return { rootPkg: null, packages: [], mode: 'none', warnings: [] };

  const warnings = [];
  const nm = path.join(root, 'node_modules');
  const lockPath = path.join(root, 'package-lock.json');
  const lock = exists(lockPath) ? readJson(lockPath) : null;
  let packages = [];
  let mode;

  if (lock && lock.packages) {
    mode = 'package-lock.json' + (exists(nm) ? ' + node_modules' : '');
    for (const [key, ent] of Object.entries(lock.packages)) {
      if (key === '' || ent.link) continue;
      const idx = key.lastIndexOf('node_modules/');
      const name = ent.name || (idx >= 0 ? key.slice(idx + 'node_modules/'.length) : key);
      const dir = path.join(root, key);
      let license = typeof ent.license === 'string' ? ent.license : declaredLicense(ent);
      let detected;
      if (needsDetect(license) && exists(dir)) {
        const inst = readJson(path.join(dir, 'package.json'));
        license = declaredLicense(inst) || license;
        if (needsDetect(license)) detected = detectFromFolder(dir);
      }
      packages.push({
        name,
        version: ent.version || 'unknown',
        scope: ent.dev || ent.devOptional ? 'dev' : 'prod',
        optional: !!ent.optional,
        license,
        detected,
        source: sourceFrom(name, ent.version, ent.resolved),
      });
    }
  } else if (lock && lock.dependencies) {
    mode = 'package-lock.json (v1)' + (exists(nm) ? ' + node_modules' : '');
    const visit = (deps, prefix) => {
      for (const [name, ent] of Object.entries(deps || {})) {
        const dir = path.join(prefix, 'node_modules', name);
        const inst = exists(dir) ? readJson(path.join(dir, 'package.json')) : null;
        packages.push({
          name,
          version: ent.version,
          scope: ent.dev ? 'dev' : 'prod',
          optional: !!ent.optional,
          license: declaredLicense(inst),
          detected: inst && needsDetect(declaredLicense(inst)) ? detectFromFolder(dir) : undefined,
          source: sourceFrom(name, ent.version, ent.resolved),
        });
        visit(ent.dependencies, dir);
      }
    };
    visit(lock.dependencies, root);
  } else if (exists(nm)) {
    mode = 'node_modules';
    packages = scanNodeModules(root, rootPkg);
  } else {
    const direct = { ...rootPkg.dependencies, ...rootPkg.optionalDependencies, ...rootPkg.peerDependencies };
    const dev = { ...rootPkg.devDependencies };
    mode = 'package.json only (nothing installed)';
    if (Object.keys(direct).length + Object.keys(dev).length) {
      warnings.push('Dependencies are declared but neither a package-lock.json nor node_modules exists, so licenses cannot be read. Run "npm ci" (or "npm install") first, then re-run.');
    }
    for (const [name, v] of Object.entries(direct)) packages.push({ name, version: String(v), scope: 'prod', license: undefined, source: sourceFrom(name) });
    for (const [name, v] of Object.entries(dev)) if (!direct[name]) packages.push({ name, version: String(v), scope: 'dev', license: undefined, source: sourceFrom(name) });
  }
  return { rootPkg, packages, mode, warnings };
}

function detectFromFolder(dir) {
  const f = findLicenseFile(dir);
  return f ? detectLicenseText(readText(f)) : undefined;
}

function sourceFrom(name, version, resolved) {
  if (resolved && !/^https?:\/\/registry\.(npmjs\.org|yarnpkg\.com)\//.test(resolved)) {
    try {
      const u = new URL(resolved.replace(/^git\+/, ''));
      u.username = '';
      u.password = '';
      return u.href;
    } catch {
      return resolved.replace(/\/\/[^@/]*@/, '//');
    }
  }
  return `https://www.npmjs.com/package/${name}${version && /^\d/.test(version) ? `/v/${version}` : ''}`;
}

function scanNodeModules(root, rootPkg) {
  const found = new Map(); // dir -> info
  const visitNm = (nmDir) => {
    let entries;
    try {
      entries = fs.readdirSync(nmDir);
    } catch {
      return;
    }
    for (const e of entries.sort()) {
      if (e.startsWith('.')) continue;
      const p = path.join(nmDir, e);
      if (e.startsWith('@')) {
        visitNm(p);
        continue;
      }
      const pj = readJson(path.join(p, 'package.json'));
      if (!pj || !pj.name) continue;
      found.set(p, { dir: p, pj });
      visitNm(path.join(p, 'node_modules'));
    }
  };
  visitNm(path.join(root, 'node_modules'));

  const resolveFrom = (fromDir, dep) => {
    let d = fromDir;
    for (;;) {
      const cand = path.join(d, 'node_modules', dep);
      if (found.has(cand)) return cand;
      if (d === root || path.dirname(d) === d) return null;
      d = path.dirname(d);
    }
  };
  const reach = (startDeps, kinds) => {
    const seen = new Set();
    const queue = [];
    for (const dep of startDeps) {
      const r = resolveFrom(root, dep);
      if (r && !seen.has(r)) {
        seen.add(r);
        queue.push(r);
      }
    }
    while (queue.length) {
      const dir = queue.shift();
      const pj = found.get(dir).pj;
      for (const k of kinds) {
        for (const dep of Object.keys(pj[k] || {})) {
          const r = resolveFrom(dir, dep);
          if (r && !seen.has(r)) {
            seen.add(r);
            queue.push(r);
          }
        }
      }
    }
    return seen;
  };
  const prod = reach([...Object.keys(rootPkg.dependencies || {}), ...Object.keys(rootPkg.optionalDependencies || {})], ['dependencies', 'optionalDependencies', 'peerDependencies']);

  return [...found.values()].map(({ dir, pj }) => ({
    name: pj.name,
    version: pj.version || 'unknown',
    scope: prod.has(dir) ? 'prod' : 'dev',
    license: declaredLicense(pj),
    detected: needsDetect(declaredLicense(pj)) ? detectFromFolder(dir) : undefined,
    source: sourceFrom(pj.name, pj.version, typeof pj._resolved === 'string' ? pj._resolved : undefined),
  }));
}

// ---------------------------------------------------------------- analysis

function matchOverride(overrides, p) {
  return overrides.find((o) => o.name === p.name && (o.version === '*' || o.version === p.version));
}

export function analyzePackages(packages, { overrides = [], registryLookup } = {}) {
  const rows = [];
  for (const p of packages) {
    let license = p.license;
    let licenseNote = '';
    let result;
    const ov = matchOverride(overrides, p);
    if (needsDetect(license) && p.detected) {
      licenseNote = `detected from LICENSE file (package.json says ${license ? `"${license}"` : 'nothing'})`;
      license = p.detected;
    }
    if (needsDetect(license) && p.registryLicense) license = p.registryLicense;
    if (ov) {
      const r = evaluateLicense(ov.license);
      result = { status: r.status === 'violation' ? 'violation' : 'note', reason: `Reviewed override (${ov.reason}). Declared: ${license || 'none'}.`, licenses: r.licenses };
      license = ov.license;
    } else {
      result = evaluateLicense(license);
      if (licenseNote && result.status === 'ok') result = { ...result, status: 'note', reason: joinNote(licenseNote, result.reason) };
      else if (licenseNote) result = { ...result, reason: joinNote(licenseNote, result.reason) };
      const hidden = HIDDEN_COPYLEFT.find((re) => re.test(p.name));
      if (hidden) {
        result = {
          status: 'violation',
          reason: `hidden copyleft: package is known to embed GPL eSpeak NG (or wrap it) even though it declares ${license || 'a permissive license'}. Needs an owner decision; add a reviewed entry to scripts/audit-license-overrides.json to accept it.`,
          licenses: result.licenses,
        };
      }
    }
    rows.push({ ...p, license: license || 'UNKNOWN', status: result.status, reason: result.reason });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version, undefined, { numeric: true }));
  return rows;
}

async function registryFill(packages, fetchFn) {
  for (const p of packages) {
    if (!needsDetect(p.license) || p.detected || !/^\d/.test(p.version)) continue;
    try {
      const res = await fetchFn(`https://registry.npmjs.org/${encodeURIComponent(p.name).replace('%40', '@')}/${p.version}`);
      if (res.ok) {
        const j = await res.json();
        const l = declaredLicense(j);
        if (l) p.registryLicense = l;
      }
    } catch {
      /* stay unknown */
    }
  }
}

// ---------------------------------------------------------------- docs/LICENSES.md

const STATUS_TEXT = { OK: 'OK', 'OK-NOTE': 'OK (see note)', VERIFY: 'VERIFY before use', 'NOT-OK': 'NOT OK' };

function renderDoc({ rootPkg, rows, mode, planned, overrides, qaRows = [], qaMode = '' }) {
  const out = [];
  const installed = new Set(rows.map((r) => r.name));
  const count = (s) => rows.filter((r) => r.status === s).length;
  out.push('# Licenses', '');
  out.push('> Generated by `node scripts/audit-licenses.mjs --write`. Do not edit by hand; change `scripts/audit-planned.json` (planned fonts, models, stack) or `scripts/audit-license-overrides.json` (reviewed exceptions) and regenerate.', '');
  out.push('PageNest is MIT licensed. Rule (blueprint section 4): every library, font and voice model must allow free distribution, and for models that includes the weights, not only the code.', '');
  out.push('Allowed: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, OFL-1.1, CC0-1.0, 0BSD, Unlicense, Zlib, BlueOak-1.0.0, Python-2.0, MPL-2.0 (note), CC-BY-4.0 (note). SPDX `OR` expressions pass when one choice is allowed, `AND` expressions only when all parts are. Flagged: GPL, AGPL, LGPL, SSPL, CC-NC, unknown, UNLICENSED.', '');

  out.push('## Summary', '');
  if (!rootPkg) {
    out.push('- Installed dependencies: none yet (no `package.json` in the repository).');
  } else {
    out.push(`- Installed packages audited: ${rows.length} (${rows.filter((r) => r.scope === 'prod').length} production, ${rows.filter((r) => r.scope === 'dev').length} development)`);
    out.push(`- Source of data: ${mode}`);
    if (qaMode) out.push(`- QA toolchain (\`tests/\`, dev only, never shipped): ${qaRows.length} packages from ${qaMode}; OK: ${qaRows.filter((r) => r.status === 'ok').length}, OK with note: ${qaRows.filter((r) => r.status === 'note').length}, NOT OK: ${qaRows.filter((r) => r.status === 'violation').length}`);
    out.push(`- OK: ${count('ok')}, OK with note: ${count('note')}, NOT OK: ${count('violation')}`);
  }
  const risks = [...planned.fonts, ...planned.icons, ...planned.dependencies, ...planned.models].filter((r) => r.status === 'VERIFY' || r.status === 'NOT-OK');
  out.push(`- Planned assets with open risks: ${risks.length} (see the Models table)`, '');

  out.push('## Dependencies (npm)', '');
  if (!rootPkg) {
    out.push('No dependencies yet.', '');
  } else if (rows.length === 0) {
    out.push('No dependencies yet.', '');
  } else {
    out.push('| Name | Version | Scope | License | Source | Status |', '|---|---|---|---|---|---|');
    for (const r of rows) {
      const status = r.status === 'ok' ? 'OK' : r.status === 'note' ? 'OK (note)' : 'NOT OK';
      out.push(`| ${escapeMd(r.name)} | ${escapeMd(r.version)} | ${r.scope}${r.optional ? ' (optional)' : ''} | ${escapeMd(r.license)} | ${escapeMd(r.source)} | ${status} |`);
    }
    out.push('');
    const withNotes = rows.filter((r) => r.reason);
    if (withNotes.length) {
      out.push('Notes:', '');
      for (const r of withNotes) out.push(`- **${escapeMd(r.name)}@${escapeMd(r.version)}**: ${escapeMd(r.reason)}`);
      out.push('');
    }
  }

  if (qaMode) {
    out.push('### QA toolchain (tests/, dev only)', '');
    out.push('Separate project in `tests/package.json` (Playwright, axe, Lighthouse). Nothing in it is bundled into the app.', '');
    out.push('| Name | Version | License | Source | Status |', '|---|---|---|---|---|');
    for (const r of qaRows) {
      const status = r.status === 'ok' ? 'OK' : r.status === 'note' ? 'OK (note)' : 'NOT OK';
      out.push(`| ${escapeMd(r.name)} | ${escapeMd(r.version)} | ${escapeMd(r.license)} | ${escapeMd(r.source)} | ${status} |`);
    }
    out.push('');
    const qaNotes = qaRows.filter((r) => r.reason);
    if (qaNotes.length) {
      out.push('Notes:', '');
      for (const r of qaNotes) out.push(`- **${escapeMd(r.name)}@${escapeMd(r.version)}**: ${escapeMd(r.reason)}`);
      out.push('');
    }
  }

  if (overrides.length) {
    out.push('### Reviewed overrides', '');
    out.push('| Package | Version | Accepted license | Reason |', '|---|---|---|---|');
    for (const o of overrides) out.push(`| ${escapeMd(o.name)} | ${escapeMd(o.version)} | ${escapeMd(o.license)} | ${escapeMd(o.reason)} |`);
    out.push('');
  }

  const table = (title, items, intro) => {
    out.push(`## ${title}`, '');
    if (intro) out.push(intro, '');
    out.push('| Name | Version | License | Source | Status | Note |', '|---|---|---|---|---|---|');
    for (const r of items) out.push(`| ${escapeMd(r.name)} | ${escapeMd(r.version)} | ${escapeMd(r.license)} | ${escapeMd(r.source)} | ${STATUS_TEXT[r.status] || r.status} | ${escapeMd(r.note || '')} |`);
    out.push('');
  };
  table('Fonts', planned.fonts, 'Planned from blueprint section 5.3. Status "planned": no font files are in the repository yet. Fonts must be self-hosted (no Google Fonts requests).');
  table('Icons', planned.icons);
  const plannedDeps = planned.dependencies.filter((d) => !d.name.split(' / ').some((n) => installed.has(n.trim())) && !installed.has(d.name));
  table('Planned stack (blueprint section 11, not installed yet)', plannedDeps, 'Expected licenses from the upstream projects. Once a package is installed it moves to the npm table above with the license read from the lockfile, and this row disappears.');
  table('Models and voice engines (planned)', planned.models, 'Blueprint 9.3 and 10: the license of the model WEIGHTS is checked per model before it is added. For Piper, every voice has its own MODEL_CARD; record each voice here when added.');

  for (const sec of planned.sections || []) {
    out.push(`## ${sec.title}`, '');
    for (let i = 0; i < sec.paragraphs.length; i++) {
      const para = sec.paragraphs[i];
      out.push(para);
      if (!(para.startsWith('- ') && (sec.paragraphs[i + 1] || '').startsWith('- '))) out.push('');
    }
  }

  out.push('## How to check', '', '```bash', 'node scripts/audit-licenses.mjs           # audit installed dependencies', 'node scripts/audit-licenses.mjs --write   # regenerate this file', 'node scripts/audit-licenses.mjs --check   # CI: fail if this file is stale', '```', '');
  return out.join('\n');
}

// ---------------------------------------------------------------- main

export async function run(argv, { cwd = process.cwd(), log = console.log, errLog = console.error, fetchFn = globalThis.fetch } = {}) {
  let args;
  try {
    args = parseArgs(argv, { root: 'string', write: 'bool', check: 'bool', json: 'bool', registry: 'bool', help: 'bool' });
  } catch (e) {
    errLog(e.message);
    return 2;
  }
  if (args.help) {
    log('Usage: node scripts/audit-licenses.mjs [--root DIR] [--write] [--check] [--json] [--registry]');
    return 0;
  }
  const root = path.resolve(cwd, args.root || '.');
  const planned = readJson(path.join(SCRIPTS_DIR, 'audit-planned.json')) || { fonts: [], icons: [], dependencies: [], models: [] };
  const overridesFile = path.join(root, 'scripts', 'audit-license-overrides.json');
  const overrides = (readJson(exists(overridesFile) ? overridesFile : path.join(SCRIPTS_DIR, 'audit-license-overrides.json')) || {}).overrides || [];
  for (const o of overrides) if (!o.name || !o.license || !o.reason) throw new Error('Each override needs name, license and reason');

  const collected = collectPackages(root);
  if (args.registry && fetchFn) await registryFill(collected.packages, fetchFn);
  const rows = analyzePackages(collected.packages, { overrides });
  // The QA toolchain lives in tests/ with its own lockfile; audit it too (dev only) when auditing the real repo root.
  let qaRows = [];
  let qaMode = '';
  if (!args.root && collected.rootPkg && exists(path.join(root, 'tests', 'package.json'))) {
    const qa = collectPackages(path.join(root, 'tests'));
    if (qa.rootPkg && qa.packages.length) {
      qaRows = analyzePackages(qa.packages, { overrides });
      qaMode = qa.mode;
    }
  }
  const violations = [...rows, ...qaRows].filter((r) => r.status === 'violation');
  const notes = [...rows, ...qaRows].filter((r) => r.status === 'note');
  const risks = [...planned.fonts, ...planned.icons, ...planned.dependencies, ...planned.models].filter((r) => r.status === 'VERIFY' || r.status === 'NOT-OK');

  let exit = violations.length ? 1 : 0;
  const docPath = path.join(root, 'docs', 'LICENSES.md');
  const doc = renderDoc({ rootPkg: collected.rootPkg, rows, mode: collected.mode, planned, overrides, qaRows, qaMode });

  if (args.json) {
    log(JSON.stringify({ root, mode: collected.mode, packages: rows.length, violations, notes: notes.length, warnings: collected.warnings, plannedRisks: risks.map((r) => ({ name: r.name, status: r.status })) }, null, 2));
  } else {
    log('PageNest license audit');
    log(`  project: ${root}`);
    if (!collected.rootPkg) {
      log('  no package.json yet: no dependencies yet, nothing to audit.');
    } else {
      log(`  data: ${collected.mode}`);
      log(`  packages: ${rows.length} root (${rows.filter((r) => r.scope === 'prod').length} prod, ${rows.filter((r) => r.scope === 'dev').length} dev); ok ${rows.length + qaRows.length - violations.length - notes.length}, notes ${notes.length}, violations ${violations.length} (including tests/)`);
      if (qaMode) log(`  tests/ (QA toolchain): ${qaRows.length} packages from ${qaMode}`);
      if (rows.length === 0 && !collected.warnings.length) log('  no dependencies yet.');
    }
    for (const w of collected.warnings) log(`  WARNING: ${w}`);
    if (violations.length) {
      log('');
      log('VIOLATIONS');
      for (const v of violations) log(`  [${v.scope}] ${v.name}@${v.version}  license: ${v.license}  -> ${v.reason}`);
    }
    if (notes.length) {
      log('');
      log('NOTES (allowed, needs attention)');
      for (const v of notes) log(`  [${v.scope}] ${v.name}@${v.version}  ${v.license}  ${v.reason}`);
    }
    if (risks.length) {
      log('');
      log(`PLANNED ASSETS WITH OPEN RISK (${risks.length}, do not fail the run)`);
      for (const r of risks) log(`  ${r.status.padEnd(6)} ${r.name} (${r.license})`);
    }
  }

  if (args.write) {
    fs.mkdirSync(path.dirname(docPath), { recursive: true });
    fs.writeFileSync(docPath, doc);
    if (!args.json) log(`\nWrote ${relPath(root, docPath)}`);
  } else if (args.check) {
    const cur = readText(docPath);
    if (cur !== doc) {
      errLog('docs/LICENSES.md is missing or out of date. Run: node scripts/audit-licenses.mjs --write');
      exit = exit || 1;
    } else if (!args.json) log('\ndocs/LICENSES.md is up to date.');
  }
  if (!args.json) log(exit ? '\nRESULT: FAIL' : '\nRESULT: PASS');
  return exit;
}

if (isMain(import.meta.url)) {
  run(process.argv.slice(2)).then((c) => process.exit(c), (e) => {
    console.error(e.stack || e.message);
    process.exit(2);
  });
}
