/** Letter-name ARPAbet fallback for OOV tokens (spell-out). */

const LETTER_PHONES: Readonly<Record<string, readonly string[]>> = {
  a: ['EY1'],
  b: ['B', 'IY1'],
  c: ['S', 'IY1'],
  d: ['D', 'IY1'],
  e: ['IY1'],
  f: ['EH1', 'F'],
  g: ['JH', 'IY1'],
  h: ['EY1', 'CH'],
  i: ['AY1'],
  j: ['JH', 'EY1'],
  k: ['K', 'EY1'],
  l: ['EH1', 'L'],
  m: ['EH1', 'M'],
  n: ['EH1', 'N'],
  o: ['OW1'],
  p: ['P', 'IY1'],
  q: ['K', 'Y', 'UW1'],
  r: ['AA1', 'R'],
  s: ['EH1', 'S'],
  t: ['T', 'IY1'],
  u: ['Y', 'UW1'],
  v: ['V', 'IY1'],
  w: ['D', 'AH1', 'B', 'AH0', 'L', 'Y', 'UW0'],
  x: ['EH1', 'K', 'S'],
  y: ['W', 'AY1'],
  z: ['Z', 'IY1'],
};

export function spellWordPhones(word: string): string[] {
  const phones: string[] = [];
  for (const ch of word.toLowerCase()) {
    const part = LETTER_PHONES[ch];
    if (part) {
      phones.push(...part);
    }
  }
  return phones;
}
