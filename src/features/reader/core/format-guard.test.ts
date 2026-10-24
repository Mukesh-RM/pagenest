import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A static guard for the rule that the reader never decides what a file is from its name, extension or MIME type.
 * The Library detects the real format from the bytes and stores it; the reader reads `book.format` and nothing else.
 */
const ROOT = resolve(__dirname, '..', '..', '..');
const DIRS = ['features/reader', 'engines/epub', 'engines/pdf'].map((d) => join(ROOT, d));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === 'e2e' || entry === 'fixtures' ? [] : files(path);
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry) && !entry.endsWith('.d.ts') ? [path] : [];
  });
}

const FORBIDDEN: ReadonlyArray<[RegExp, string]> = [
  [/\bextname\b/, 'path extension helper'],
  [/\.(?:endsWith|startsWith)\(\s*['"`]\./, 'file extension test'],
  [/\.lastIndexOf\(\s*['"`]\.['"`]/, 'extension split'],
  [/split\(\s*['"`]\.['"`]\s*\)\s*\.(?:pop|at)\(/, 'extension split'],
  [/\b(?:file|blob|source\.file)\.name\b/, 'file name read'],
  [/\b(?:file|blob|source\.file)\.type\b/, 'MIME type read'],
  [/mime-types|mimeFromName|lookup\(\s*(?:file|name)/, 'MIME lookup by name'],
  [/\/\\\.(?:epub|pdf|mobi|azw3?|fb2|cbz|docx?|txt|rtf|html?|md)\b/i, 'extension regular expression'],
  [/makeBook\(/, "foliate's makeBook sniffs the file name; call the parser for the stored format instead"],
];

describe('the reader decides the format from the stored format only', () => {
  const sources = DIRS.flatMap(files).map((path) => ({ path: relative(ROOT, path), text: readFileSync(path, 'utf8') }));

  it('finds the reader sources to check', () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it.each(FORBIDDEN)('has no %s (%s)', (pattern, why) => {
    const hits = sources.filter((s) => s.text.split('\n').some((line) => !/^\s*(\/\/|\*|\/\*)/.test(line) && pattern.test(line))).map((s) => s.path);
    expect(hits, why).toEqual([]);
  });

  it('routes by the stored format in the registry', () => {
    const registry = sources.find((s) => s.path.endsWith('core/registry.ts'))?.text ?? '';
    expect(registry).toContain('book.format');
    expect(registry).not.toMatch(/\.name\b|\.type\b/);
  });
});
