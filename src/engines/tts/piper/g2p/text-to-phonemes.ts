import { lookupCmudict } from './cmudict-data';
import { arpabetPhonesToIpa } from './arpabet-to-ipa';

const WORD = /[A-Za-z']+/g;

/**
 * Grapheme-to-phoneme for Piper using CMUdict lookups and letter fallback (Decision 8).
 * Output uses IPA symbols expected by Piper phoneme_id_map (no GPL phonemizer).
 */
export function textToPhonemeString(text: string): string {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(WORD)) {
    const idx = m.index ?? 0;
    out += sanitizeNonWord(text.slice(last, idx));
    const word = m[0];
    const phones = lookupCmudict(word);
    out += phones ? arpabetPhonesToIpa(phones) : spellFallback(word);
    last = idx + word.length;
  }
  out += sanitizeNonWord(text.slice(last));
  return out.trim();
}

function sanitizeNonWord(chunk: string): string {
  return chunk
    .replace(/\s+/g, ' ')
    .replace(/[^\s\w.,!?;:'"()-]/gu, '');
}

function spellFallback(word: string): string {
  return word
    .toLowerCase()
    .split('')
    .filter((c) => /[a-z']/.test(c))
    .join('');
}
