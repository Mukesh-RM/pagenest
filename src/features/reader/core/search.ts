import type { SearchHit } from '@/engines/reader/types';
import type { Locator, TextRange } from '@/app/contracts';

/** Options for in-book search. All off by default: case, accents and word parts do not matter. */
export interface SearchOptions {
  readonly matchCase?: boolean;
  readonly matchDiacritics?: boolean;
  readonly wholeWords?: boolean;
}

export interface Match {
  /** Inclusive start offset in the original text. */
  readonly start: number;
  /** Exclusive end offset in the original text. */
  readonly end: number;
}

interface Folded {
  readonly text: string;
  /** For each folded code unit, the original index it came from. */
  readonly map: readonly number[];
}

const MARKS = /\p{M}/u;

/**
 * Fold `text` for matching: optional lower-casing, optional accent removal, runs of whitespace become one space.
 * Keeps a map back to original offsets so matches highlight the exact original characters.
 */
function fold(text: string, opts: SearchOptions): Folded {
  const out: string[] = [];
  const map: number[] = [];
  let lastSpace = false;
  let i = 0;
  while (i < text.length) {
    const cp = text.codePointAt(i) as number;
    const ch = String.fromCodePoint(cp);
    const width = ch.length;
    if (/\s/u.test(ch) || cp === 0xad /* soft hyphen */) {
      if (cp !== 0xad && !lastSpace) {
        out.push(' ');
        map.push(i);
        lastSpace = true;
      }
      i += width;
      continue;
    }
    lastSpace = false;
    let f = ch;
    if (!opts.matchDiacritics) f = f.normalize('NFD').replace(/\p{M}/gu, '');
    if (!opts.matchCase) f = f.toLowerCase();
    if (f === '' && MARKS.test(ch)) {
      i += width;
      continue; // a lone combining mark folds away
    }
    for (const unit of f) {
      for (let k = 0; k < unit.length; k++) {
        out.push(unit[k] as string);
        map.push(i);
      }
    }
    i += width;
  }
  return { text: out.join(''), map };
}

const WORD = /[\p{L}\p{N}_]/u;

/** All matches of `query` in `text`, non-overlapping, in order. Empty or blank queries match nothing. */
export function findMatches(text: string, query: string, opts: SearchOptions = {}): Match[] {
  const needle = fold(query, opts).text.trim();
  if (!needle) return [];
  const hay = fold(text, opts);
  const found: Match[] = [];
  let from = 0;
  for (;;) {
    const at = hay.text.indexOf(needle, from);
    if (at < 0) break;
    const endFolded = at + needle.length;
    from = endFolded;
    if (opts.wholeWords) {
      const before = hay.text[at - 1];
      const after = hay.text[endFolded];
      if ((before && WORD.test(before)) || (after && WORD.test(after))) continue;
    }
    const start = hay.map[at] as number;
    const lastOriginal = hay.map[endFolded - 1] as number;
    const lastCp = text.codePointAt(lastOriginal) as number;
    found.push({ start, end: lastOriginal + (lastCp > 0xffff ? 2 : 1) });
  }
  return found;
}

const CONTEXT = 40;

const squash = (s: string): string => s.replace(/\s+/g, ' ');

/** A short excerpt around a match, with the match position inside it. */
export function excerptAround(text: string, match: Match): { excerpt: string; matchStart: number; matchEnd: number } {
  const before = squash(text.slice(Math.max(0, match.start - CONTEXT), match.start)).replace(/^\s+/, '');
  const mid = squash(text.slice(match.start, match.end));
  const after = squash(text.slice(match.end, match.end + CONTEXT)).replace(/\s+$/, '');
  const pre = match.start - CONTEXT > 0 ? '…' : '';
  const post = match.end + CONTEXT < text.length ? '…' : '';
  const matchStart = pre.length + before.length;
  return { excerpt: `${pre}${before}${mid}${after}${post}`, matchStart, matchEnd: matchStart + mid.length };
}

/**
 * Search one section or page and describe each match as a {@link SearchHit}. `locate(offset)` turns an offset into
 * the locator the engine uses (reflow section + text offset for EPUB, page text offset for PDF).
 */
export function searchText(
  text: string,
  query: string,
  locate: (offset: number) => Locator,
  opts: SearchOptions = {},
): SearchHit[] {
  return findMatches(text, query, opts).map((m) => {
    const range: TextRange = { start: locate(m.start), end: locate(m.end) };
    return { range, ...excerptAround(text, m) };
  });
}
