/** Words safe for on-screen consent phrases (no slurs, no personal data). */
export const CONSENT_WORDS = [
  'amber',
  'anchor',
  'apple',
  'arbor',
  'atlas',
  'breeze',
  'candle',
  'cedar',
  'cloud',
  'compass',
  'coral',
  'delta',
  'ember',
  'falcon',
  'garden',
  'harbor',
  'ivory',
  'jasmine',
  'kelp',
  'lilac',
  'meadow',
  'mirror',
  'nectar',
  'ocean',
  'orchid',
  'paper',
  'pebble',
  'pilot',
  'quartz',
  'river',
  'saffron',
  'silver',
  'summit',
  'temple',
  'thistle',
  'timber',
  'velvet',
  'violet',
  'willow',
  'zenith',
] as const;

export type ConsentPhrase = {
  readonly text: string;
  readonly token: string;
};

/** Pick `count` distinct words and join them into a phrase the user must read aloud. */
export function buildConsentPhrase(count = 4, random = Math.random): ConsentPhrase {
  const pool = [...CONSENT_WORDS];
  const words: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(random() * pool.length);
    words.push(pool.splice(idx, 1)[0]!);
  }
  const text = words.join(' ');
  return { text, token: text.toLowerCase().replace(/\s+/g, '-') };
}
