import { arpabetWordToIpa } from './arpabet-to-ipa';
import type { CmuDict } from './cmu-dict';
import { lookupPronunciation } from './cmu-dict';
import { normalizeEnglishForG2p, tokenizeWords } from './normalize';
import { spellWordPhones } from './rules-fallback';
import { PIPER_WORD_SPACE } from '../piper/phoneme-ids';
import type { PiperVoiceConfig } from '../piper/piper-voice-config';
import { encodePhonemeString, phonemeMapCoverage } from '../piper/phoneme-ids';

export interface EnglishG2pResult {
  readonly phonemeString: string;
  readonly phonemeIds: Int32Array;
  readonly oovWords: readonly string[];
  readonly unknownSymbols: readonly string[];
  readonly dictHits: number;
  readonly dictMisses: number;
}

export interface EnglishG2pOptions {
  readonly dict: CmuDict;
  readonly voiceConfig: PiperVoiceConfig;
}

/**
 * CMUdict + rules English G2P → Piper phoneme ids (no espeak).
 */
export function englishTextToPhonemeIds(text: string, options: EnglishG2pOptions): EnglishG2pResult {
  const normalized = normalizeEnglishForG2p(text);
  const words = tokenizeWords(normalized);
  const oov: string[] = [];
  let hits = 0;
  let misses = 0;
  const ipaParts: string[] = [];

  for (const word of words) {
    const phones = lookupPronunciation(options.dict, word);
    if (phones) {
      hits += 1;
      ipaParts.push(arpabetWordToIpa(phones));
    } else {
      misses += 1;
      oov.push(word);
      ipaParts.push(arpabetWordToIpa(spellWordPhones(word)));
    }
  }

  const phonemeString = ipaParts.join(PIPER_WORD_SPACE);
  const encoded = encodePhonemeString(options.voiceConfig, phonemeString);
  return {
    phonemeString,
    phonemeIds: encoded.ids,
    oovWords: oov,
    unknownSymbols: encoded.unknownSymbols,
    dictHits: hits,
    dictMisses: misses,
  };
}

export function collectSymbolsFromPhonemeString(phonemeString: string): string[] {
  const symbols: string[] = [];
  for (const ch of phonemeString) {
    if (ch !== '\n' && ch !== '\r') {
      symbols.push(ch);
    }
  }
  return symbols;
}

export function g2pMappingCoverage(phonemeString: string, config: PiperVoiceConfig) {
  return phonemeMapCoverage(config, collectSymbolsFromPhonemeString(phonemeString));
}
