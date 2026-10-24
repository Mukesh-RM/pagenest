/**
 * ARPAbet (CMUdict) → espeak-style IPA single-character symbols used in Piper `phoneme_id_map`.
 */

const VOWEL_BASE: Readonly<Record<string, string>> = {
  AA: 'ɑ',
  AE: 'æ',
  AH: 'ə',
  AO: 'ɔ',
  AW: 'aʊ',
  AY: 'aɪ',
  EH: 'e',
  ER: 'ɚ',
  EY: 'eɪ',
  IH: 'ɪ',
  IY: 'i',
  OW: 'oʊ',
  OY: 'ɔɪ',
  UH: 'ʊ',
  UW: 'u',
};

const CONSONANT: Readonly<Record<string, string>> = {
  B: 'b',
  CH: 'tʃ',
  D: 'd',
  DH: 'ð',
  F: 'f',
  G: 'ɡ',
  HH: 'h',
  JH: 'dʒ',
  K: 'k',
  L: 'l',
  M: 'm',
  N: 'n',
  NG: 'ŋ',
  P: 'p',
  R: 'ɹ',
  S: 's',
  SH: 'ʃ',
  T: 't',
  TH: 'θ',
  V: 'v',
  W: 'w',
  Y: 'j',
  Z: 'z',
  ZH: 'ʒ',
};

/** Expand ARPAbet phones like `HH`, `AH0`, `L` into IPA characters (stress applied). */
export function arpabetPhoneToIpa(phone: string): string {
  const match = /^([A-Z]+)([012])?$/.exec(phone.toUpperCase());
  if (!match) {
    return '';
  }
  const base = match[1] ?? '';
  const stress = match[2] ?? '0';
  const vowel = VOWEL_BASE[base];
  if (vowel) {
    const stressMark = stress === '1' ? 'ˈ' : stress === '2' ? 'ˌ' : '';
    return stressMark + vowel;
  }
  const consonant = CONSONANT[base];
  return consonant ?? '';
}

export function arpabetWordToIpa(phones: readonly string[]): string {
  return phones.map((p) => arpabetPhoneToIpa(p)).join('');
}
