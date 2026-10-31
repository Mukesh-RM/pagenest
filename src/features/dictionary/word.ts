/** Read the word under a pointer, or `undefined` when nothing is readable. */
export function wordAtPoint(doc: Document, x: number, y: number): string | undefined {
  const target = doc.elementFromPoint(x, y);
  if (!target || target.closest('button, [role="toolbar"], .pn-dict-popup')) return undefined;
  const range = doc.caretRangeFromPoint?.(x, y);
  if (!range) return undefined;
  const word = wordFromRange(range);
  return word.length >= 2 ? word : undefined;
}

/** Pick a single dictionary word from plain text or expand a selection to one headword. */
export function primaryWord(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  return first.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'-]+$/gu, '');
}

/** Expand a DOM text node range to word boundaries (for tap-to-define). */
export function wordFromRange(range: Range): string {
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return primaryWord(range.toString());
  const text = node.textContent ?? '';
  let start = range.startOffset;
  let end = range.endOffset;
  while (start > 0 && /[\p{L}\p{N}'-]/u.test(text[start - 1]!)) start--;
  while (end < text.length && /[\p{L}\p{N}'-]/u.test(text[end]!)) end++;
  return primaryWord(text.slice(start, end));
}
