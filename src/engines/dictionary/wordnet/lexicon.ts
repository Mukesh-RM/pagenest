import type { DefinitionResult, DefinitionSense } from '../types';

export interface WordnetPackJson {
  readonly version: number;
  readonly entries: Readonly<Record<string, { readonly pos: string; readonly glosses: readonly string[] }>>;
}

/** Parse a WordNet-derived JSON pack into a lookup map. */
export function loadWordnetPack(bytes: ArrayBuffer | string): Map<string, DefinitionSense[]> {
  const text = typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes);
  const data = JSON.parse(text) as WordnetPackJson;
  const map = new Map<string, DefinitionSense[]>();
  for (const [word, row] of Object.entries(data.entries)) {
    map.set(normalizeWord(word), [{ pos: row.pos, glosses: row.glosses }]);
  }
  return map;
}

export function lookupWordnet(map: Map<string, DefinitionSense[]>, word: string): DefinitionResult {
  const key = normalizeWord(word);
  const senses = map.get(key);
  if (!senses?.length) {
    return { word: key, senses: [], source: 'none' };
  }
  return { word: key, senses, source: 'wordnet' };
}

export function normalizeWord(raw: string): string {
  return raw
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'-]+$/gu, '')
    .toLowerCase();
}
