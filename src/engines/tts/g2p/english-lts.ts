/**
 * Rule-based English letter-to-sound (LTS) for OOV words.
 * Self-authored grapheme rules (MIT); not derived from eSpeak or GPL sources.
 */

const VOWEL_DIGRAPHS: Readonly<Record<string, string[]>> = {
  ai: ['EY1'],
  ay: ['EY1'],
  ea: ['IY1'],
  ee: ['IY1'],
  ie: ['IY1'],
  oa: ['OW1'],
  oo: ['UW1'],
  ou: ['AW1'],
  ow: ['OW1'],
  ei: ['EY1'],
  eu: ['Y', 'UW1'],
  ui: ['UW1'],
};

const CONSONANT_DIGRAPHS: Readonly<Record<string, string[]>> = {
  ch: ['CH'],
  sh: ['SH'],
  th: ['TH'],
  ph: ['F'],
  gh: ['G'],
  ck: ['K'],
  ng: ['NG'],
  qu: ['K', 'W'],
  tch: ['CH'],
  dge: ['JH'],
};

const SINGLE: Readonly<Record<string, string[]>> = {
  a: ['AE1'],
  b: ['B'],
  c: ['K'],
  d: ['D'],
  e: ['EH1'],
  f: ['F'],
  g: ['G'],
  h: ['HH'],
  i: ['IH1'],
  j: ['JH'],
  k: ['K'],
  l: ['L'],
  m: ['M'],
  n: ['N'],
  o: ['OW1'],
  p: ['P'],
  q: ['K'],
  r: ['R'],
  s: ['S'],
  t: ['T'],
  u: ['AH1'],
  v: ['V'],
  w: ['W'],
  x: ['K', 'S'],
  y: ['Y'],
  z: ['Z'],
};

/** Pronounce an unknown English token using grapheme rules (ARPAbet phones). */
export function ltsEnglishWord(word: string): string[] {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) {
    return [];
  }

  const phones: string[] = [];
  let i = 0;
  while (i < w.length) {
    const tri = w.slice(i, i + 3);
    const dig = w.slice(i, i + 2);
    const ch = w[i] ?? '';

    if (CONSONANT_DIGRAPHS[tri]) {
      phones.push(...CONSONANT_DIGRAPHS[tri]);
      i += 3;
      continue;
    }
    if (VOWEL_DIGRAPHS[dig]) {
      phones.push(...VOWEL_DIGRAPHS[dig]);
      i += 2;
      continue;
    }
    if (CONSONANT_DIGRAPHS[dig]) {
      phones.push(...CONSONANT_DIGRAPHS[dig]);
      i += 2;
      continue;
    }

    if (ch === 'e' && i === w.length - 1 && phones.length > 0) {
      i += 1;
      continue;
    }
    if (ch === 'y' && i === w.length - 1) {
      phones.push('IY1');
      i += 1;
      continue;
    }

    const single = SINGLE[ch];
    if (single) {
      phones.push(...single);
    }
    i += 1;
  }

  return phones.length > 0 ? phones : ['AH1'];
}
