/**
 * CMUdict parser (pronouncing format). Data is loaded on demand (OPFS / fetch), not in the app shell.
 * License: Carnegie Mellon Pronouncing Dictionary — unrestricted use with attribution
 * (see docs/NARRATION_PIPER.md).
 */

export type CmuDict = ReadonlyMap<string, readonly string[]>;

/** Parse standard CMUdict lines (`WORD  PHONE1 PHONE2` or `WORD(2)` variants). */
export function parseCmudict(text: string): CmuDict {
  const map = new Map<string, string[]>();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';;;')) {
      continue;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) {
      continue;
    }
    const rawWord = parts[0] ?? '';
    const word = rawWord.replace(/\(\d+\)$/, '').toUpperCase();
    const phones = parts.slice(1);
    if (!map.has(word)) {
      map.set(word, phones);
    }
  }
  return map;
}

export function lookupPronunciation(dict: CmuDict, word: string): readonly string[] | undefined {
  return dict.get(word.toUpperCase());
}

/** Compact line-oriented export for OPFS storage (uppercase word + tab + phones). */
export function serializeCompactCmudict(dict: CmuDict): string {
  const lines: string[] = [];
  for (const [word, phones] of [...dict.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`${word}\t${phones.join(' ')}`);
  }
  return lines.join('\n');
}

export function parseCompactCmudict(text: string): CmuDict {
  const map = new Map<string, string[]>();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const word = line.slice(0, tab).toUpperCase();
    const phones = line.slice(tab + 1).trim().split(/\s+/);
    map.set(word, phones);
  }
  return map;
}
