export interface LexiconPackJson {
  readonly version: number;
  readonly pair: string;
  readonly forward: Readonly<Record<string, string>>;
  readonly reverse?: Readonly<Record<string, string>>;
}

export function loadLexiconPack(bytes: ArrayBuffer | string): LexiconPackJson {
  const text = typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes);
  return JSON.parse(text) as LexiconPackJson;
}

/** Translate a single word or short phrase using a bilingual lexicon pack. */
export function translateWithLexicon(
  pack: LexiconPackJson,
  text: string,
  sourceLang: string,
  targetLang: string,
): { translation: string; engine: 'lexicon' | 'none' } {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const meta = pack.pair.split('-');
  const packSrc = meta[0] ?? 'en';
  const packTgt = meta[1] ?? 'hi';
  const forward = sourceLang.startsWith(packSrc) && targetLang.startsWith(packTgt);
  const reverse = sourceLang.startsWith(packTgt) && targetLang.startsWith(packSrc);
  if (forward) {
    const hit = pack.forward[lower] ?? pack.forward[trimmed];
    if (hit) return { translation: hit, engine: 'lexicon' };
  }
  if (reverse && pack.reverse) {
    const hit = pack.reverse[lower] ?? pack.reverse[trimmed];
    if (hit) return { translation: hit, engine: 'lexicon' };
  }
  return { translation: '', engine: 'none' };
}
