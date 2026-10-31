import type { SentenceSpan } from './types';

const ABBREV = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e|U\.S|U\.K)\./gi;

/**
 * Split plain chapter text into sentences with UTF-16 offsets (same indexing as the reader).
 * Keeps trailing punctuation on the sentence; skips empty runs.
 */
export function splitSentences(text: string): SentenceSpan[] {
  if (!text.trim()) return [];
  const protectedText = text.replace(ABBREV, (m) => m.replace(/\./g, '\u2024'));
  const parts = protectedText.split(/(?<=[.!?…]["')\]]?)(?=\s+|$)/u);
  const out: SentenceSpan[] = [];
  let cursor = 0;
  for (const raw of parts) {
    const piece = raw.replace(/\u2024/g, '.');
    if (!piece.trim()) {
      cursor += piece.length;
      continue;
    }
    const start = text.indexOf(piece.trimStart(), cursor);
    const trimmedLead = piece.length - piece.trimStart().length;
    const actualStart = start >= 0 ? start : cursor + trimmedLead;
    const trimmed = piece.trim();
    const end = actualStart + trimmed.length;
    out.push({ index: out.length, text: trimmed, start: actualStart, end });
    cursor = end;
    while (cursor < text.length && /\s/.test(text[cursor] ?? '')) cursor += 1;
  }
  return out;
}
