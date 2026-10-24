export type SegmentKind = 'narration' | 'dialogue';

export interface NarrationSegment {
  readonly kind: SegmentKind;
  readonly text: string;
  /** UTF-16 start in source passage. */
  readonly start: number;
  readonly end: number;
  /** Lowercase speech verb if detected (`she whispered`). */
  readonly attributionVerb?: string;
  /** Guessed speaker label (`she`, `Tom`, `narrator`). */
  readonly speakerHint?: string;
}

const SPEECH_VERBS =
  /\b(whispered|murmured|shouted|yelled|screamed|said|asked|replied|answered|laughed|cried|growled)\b/i;

const ATTRIBUTION = new RegExp(
  `\\b([A-Za-z]+|he|she|they)\\s+${SPEECH_VERBS.source}\\s*[:,]?\\s*`,
  'i',
);

/**
 * Split passage into narration vs quoted dialogue with light speaker attribution.
 */
export function segmentNarrationAndDialogue(passage: string): readonly NarrationSegment[] {
  const segments: NarrationSegment[] = [];
  let i = 0;
  const len = passage.length;

  while (i < len) {
    const quote = findOpeningQuote(passage, i);
    if (quote < 0) {
      const rest = passage.slice(i).trim();
      if (rest) {
        segments.push({
          kind: 'narration',
          text: rest,
          start: i,
          end: len,
        });
      }
      break;
    }

    if (quote > i) {
      const narr = passage.slice(i, quote).trim();
      if (narr) {
        const verbMatch = narr.match(SPEECH_VERBS);
        const attr = narr.match(ATTRIBUTION);
        segments.push({
          kind: 'narration',
          text: narr,
          start: i,
          end: quote,
          attributionVerb: verbMatch?.[1]?.toLowerCase(),
          speakerHint: attr?.[1]?.toLowerCase(),
        });
      }
    }

    const close = findClosingQuote(passage, quote + 1);
    if (close < 0) {
      segments.push({
        kind: 'narration',
        text: passage.slice(quote).trim(),
        start: quote,
        end: len,
      });
      break;
    }

    const inner = passage.slice(quote + 1, close).trim();
    if (inner) {
      segments.push({
        kind: 'dialogue',
        text: inner,
        start: quote + 1,
        end: close,
      });
    }
    i = close + 1;
    while (i < len && /[\s,]/.test(passage[i] ?? '')) {
      i += 1;
    }
  }

  return segments;
}

function findOpeningQuote(text: string, from: number): number {
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' || ch === '“' || ch === '‘') {
      return i;
    }
  }
  return -1;
}

function findClosingQuote(text: string, from: number): number {
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' || ch === '”' || ch === '’') {
      return i;
    }
  }
  return -1;
}
