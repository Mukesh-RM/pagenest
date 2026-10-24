import type { PiperVoiceConfig } from './piper-voice-config';

/** Piper wraps utterances with pad / BOS / EOS markers (see voice `phoneme_id_map`). */
export const PIPER_PAD = '_';
export const PIPER_BOS = '^';
export const PIPER_EOS = '$';
export const PIPER_WORD_SPACE = ' ';

export interface PhonemeEncodeResult {
  readonly ids: Int32Array;
  readonly unknownSymbols: readonly string[];
}

/**
 * Encode an espeak-style IPA phoneme string (single-codepoint symbols, spaces between words)
 * into the int64 phoneme id tensor Piper expects.
 */
export function encodePhonemeString(
  config: PiperVoiceConfig,
  phonemeString: string,
): PhonemeEncodeResult {
  const map = config.phoneme_id_map;
  const ids: number[] = [];
  const unknown: string[] = [];

  const pushSymbol = (sym: string) => {
    const mapped = map[sym];
    if (!mapped || mapped.length === 0) {
      unknown.push(sym);
      return;
    }
    for (const id of mapped) {
      ids.push(id);
    }
  };

  pushSymbol(PIPER_PAD);
  pushSymbol(PIPER_BOS);

  for (const char of phonemeString) {
    if (char === '\n' || char === '\r' || char === '\t') {
      continue;
    }
    pushSymbol(char);
  }

  pushSymbol(PIPER_EOS);
  pushSymbol(PIPER_PAD);

  return { ids: Int32Array.from(ids), unknownSymbols: unknown };
}

export function phonemeMapCoverage(
  config: PiperVoiceConfig,
  symbols: Iterable<string>,
): { readonly covered: number; readonly total: number; readonly missing: readonly string[] } {
  const map = config.phoneme_id_map;
  const missing: string[] = [];
  let total = 0;
  let covered = 0;
  for (const sym of symbols) {
    total += 1;
    if (map[sym]) {
      covered += 1;
    } else {
      missing.push(sym);
    }
  }
  return { covered, total, missing };
}
