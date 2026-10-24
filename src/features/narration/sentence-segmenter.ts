/**
 * Sentence segmentation for narration (blueprint §9.2 step 1).
 * Uses `Intl.Segmenter` when available; falls back to a rule-based splitter that
 * respects common abbreviations, decimals, ellipses, quotes, and CJK punctuation.
 */

export interface SentenceSpan {
  readonly index: number;
  /** Inclusive start, exclusive end — UTF-16 offsets in the source string. */
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

const ABBREV = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'st',
  'vs',
  'etc',
  'e.g',
  'i.e',
  'u.s',
  'u.k',
  'no',
  'fig',
  'al',
  'gen',
  'gov',
  'rep',
  'sen',
  'capt',
  'col',
  'lt',
  'sgt',
  'rev',
  'hon',
  'esq',
  'ph.d',
  'm.d',
  'b.a',
  'm.a',
  'd.c',
  'a.m',
  'p.m',
]);

/** True when `Intl.Segmenter` can segment sentences for `locale`. */
export function hasSentenceSegmenter(locale: string): boolean {
  try {
    return typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter(locale, { granularity: 'sentence' }).resolvedOptions().granularity ===
          'sentence'
      : false;
  } catch {
    return false;
  }
}

/**
 * Split `text` into sentence spans. Empty trailing fragments are dropped.
 * `locale` is a BCP 47 tag (e.g. `en`, `hi`, `zh-Hans`).
 */
export function segmentSentences(text: string, locale = 'en'): readonly SentenceSpan[] {
  if (!text.trim()) {
    return [];
  }
  if (hasSentenceSegmenter(locale)) {
    return segmentWithIntl(text, locale);
  }
  return segmentWithRules(text);
}

function segmentWithIntl(text: string, locale: string): readonly SentenceSpan[] {
  const segmenter = new Intl.Segmenter(locale, { granularity: 'sentence' });
  const spans: SentenceSpan[] = [];
  let index = 0;
  for (const part of segmenter.segment(text)) {
    const segment = part.segment;
    const start = part.index;
    const end = start + segment.length;
    const trimmed = segment.trim();
    if (!trimmed) {
      continue;
    }
    const lead = segment.length - segment.trimStart().length;
    const trail = segment.length - segment.trimEnd().length;
    const startOffset = start + lead;
    const endOffset = end - trail;
    spans.push({
      index,
      start: startOffset,
      end: endOffset,
      text: text.slice(startOffset, endOffset),
    });
    index += 1;
  }
  return spans;
}

/** Rule-based splitter used when `Intl.Segmenter` is missing or unsuitable. */
export function segmentWithRules(text: string): readonly SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  let index = 0;
  let i = 0;
  const len = text.length;

  while (i < len) {
    while (i < len && /\s/.test(text[i] ?? '')) {
      i += 1;
    }
    if (i >= len) {
      break;
    }
    const start = i;
    let end = findSentenceEnd(text, i);
    while (end < len && /\s/.test(text[end] ?? '')) {
      end += 1;
    }
    const slice = text.slice(start, end).trimEnd();
    const endTrimmed = start + slice.length;
    if (slice.length > 0) {
      spans.push({ index, start, end: endTrimmed, text: slice });
      index += 1;
    }
    i = endTrimmed;
    while (i < len && /\s/.test(text[i] ?? '')) {
      i += 1;
    }
  }
  return spans;
}

function findSentenceEnd(text: string, from: number): number {
  const len = text.length;
  let i = from;
  while (i < len) {
    const ch = text[i] ?? '';
    if (isCjkSentenceEnd(ch)) {
      return i + 1;
    }
    if (ch === '.' || ch === '!' || ch === '?') {
      if (ch === '.' && isDecimalPoint(text, i)) {
        i += 1;
        continue;
      }
      if (ch === '.' && isAbbreviationPeriod(text, i)) {
        i += 1;
        continue;
      }
      if (ch === '.' && i + 1 < len && text[i + 1] === '.') {
        let j = i;
        while (j < len && text[j] === '.') {
          j += 1;
        }
        if (j < len && (text[j] === ' ' || text[j] === '\n' || isCjkSentenceEnd(text[j] ?? ''))) {
          return j;
        }
        i = j;
        continue;
      }
      const quoteClose = peekClosingQuote(text, i + 1);
      return quoteClose > i + 1 ? quoteClose : i + 1;
    }
    i += 1;
  }
  return len;
}

function isCjkSentenceEnd(ch: string): boolean {
  return (
    ch === '。' ||
    ch === '！' ||
    ch === '？' ||
    ch === '．' ||
    ch === '｡' ||
    ch === '﹗' ||
    ch === '﹖'
  );
}

function isDecimalPoint(text: string, dotIndex: number): boolean {
  const before = dotIndex > 0 ? text.charAt(dotIndex - 1) : '';
  const after = dotIndex + 1 < text.length ? text.charAt(dotIndex + 1) : '';
  return before !== '' && after !== '' && /\d/.test(before) && /\d/.test(after);
}

function isAbbreviationPeriod(text: string, dotIndex: number): boolean {
  let j = dotIndex - 1;
  while (j >= 0 && /[A-Za-z.]/.test(text[j] ?? '')) {
    j -= 1;
  }
  const word = text.slice(j + 1, dotIndex).toLowerCase().replace(/\.$/, '');
  if (ABBREV.has(word)) {
    return true;
  }
  if (/^[a-z]$/i.test(word) && dotIndex + 1 < text.length && /[a-z]/i.test(text[dotIndex + 1] ?? '')) {
    return true;
  }
  return false;
}

function peekClosingQuote(text: string, from: number): number {
  let i = from;
  while (i < text.length && /['"”’)\]]/.test(text[i] ?? '')) {
    i += 1;
  }
  return i;
}
