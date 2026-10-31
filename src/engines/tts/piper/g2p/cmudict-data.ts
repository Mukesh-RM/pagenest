/** Tiny CMUdict subset for offline tests and cold start; full dict can be lazy-loaded later. */
export const CMUDICT_SNIPPET: Readonly<Record<string, readonly string[]>> = {
  HELLO: ['HH', 'AH0', 'L', 'OW1'],
  WORLD: ['W', 'ER1', 'L', 'D'],
  PAGE: ['P', 'EY1', 'JH'],
  NEST: ['N', 'EH1', 'S', 'T'],
  READ: ['R', 'IY1', 'D'],
  BOOK: ['B', 'UH1', 'K'],
  CHAPTER: ['CH', 'AE1', 'P', 'T', 'ER0'],
  ALICE: ['AE1', 'L', 'AH0', 'S'],
  WHITE: ['W', 'AY1', 'T'],
  RABBIT: ['R', 'AE1', 'B', 'AH0', 'T'],
  SAID: ['S', 'EH1', 'D'],
  THE: ['DH', 'AH0'],
  A: ['AH0'],
  AN: ['AE1', 'N'],
  AND: ['AE1', 'N', 'D'],
  TO: ['T', 'UW1'],
  OF: ['AH1', 'V'],
  IN: ['IH1', 'N'],
  IT: ['IH1', 'T'],
  IS: ['IH1', 'Z'],
  WAS: ['W', 'AH1', 'Z'],
  FOR: ['F', 'AO1', 'R'],
  ON: ['AA1', 'N'],
  WITH: ['W', 'IH1', 'DH'],
  THAT: ['DH', 'AE1', 'T'],
  THIS: ['DH', 'IH1', 'S'],
};

export function lookupCmudict(word: string): readonly string[] | undefined {
  return CMUDICT_SNIPPET[word.toUpperCase()];
}
