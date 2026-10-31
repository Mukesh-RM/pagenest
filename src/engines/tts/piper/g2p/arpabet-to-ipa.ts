/** Map ARPAbet phones to IPA single-character symbols used in Piper phoneme_id_map (not eSpeak-ng). */
const ARPA_TO_IPA: Record<string, string> = {
  AA: 'ɑ',
  AE: 'æ',
  AH: 'ə',
  AO: 'ɔ',
  AW: 'aʊ',
  AY: 'aɪ',
  B: 'b',
  CH: 'tʃ',
  D: 'd',
  DH: 'ð',
  EH: 'ɛ',
  ER: 'ɚ',
  EY: 'eɪ',
  F: 'f',
  G: 'ɡ',
  HH: 'h',
  IH: 'ɪ',
  IY: 'i',
  JH: 'dʒ',
  K: 'k',
  L: 'l',
  M: 'm',
  N: 'n',
  NG: 'ŋ',
  OW: 'oʊ',
  OY: 'ɔɪ',
  P: 'p',
  R: 'r',
  S: 's',
  SH: 'ʃ',
  T: 't',
  TH: 'θ',
  UH: 'ʊ',
  UW: 'u',
  V: 'v',
  W: 'w',
  Y: 'j',
  Z: 'z',
  ZH: 'ʒ',
};

export function arpabetPhonesToIpa(phones: readonly string[]): string {
  return phones
    .map((p) => {
      const base = p.replace(/\d+$/, '');
      return ARPA_TO_IPA[base] ?? base.toLowerCase();
    })
    .join('');
}
