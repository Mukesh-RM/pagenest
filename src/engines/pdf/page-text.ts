/**
 * Page text as search and highlights see it. pdf.js hands out text items; the text layer shows one element per item.
 * The page string is the items joined in order, with a newline after an item that ends a line, so an offset in the
 * string maps to exactly one item and a character inside it.
 */

export interface TextItemLike {
  readonly str: string;
  readonly hasEOL?: boolean;
  /** PDF transform matrix; [4] and [5] are the item's origin in PDF user space. */
  readonly transform?: readonly number[];
}

export interface PageTextItem {
  readonly str: string;
  /** Offset of the first character in the page string. */
  readonly offset: number;
  /** Characters the item takes in the page string (its text plus a virtual newline at a line end). */
  readonly length: number;
  readonly x: number;
  readonly y: number;
}

export interface PageText {
  readonly text: string;
  readonly items: readonly PageTextItem[];
}

/** Build the page string from pdf.js text content items. Items without a string (marked content) are skipped. */
export function buildPageText(items: ReadonlyArray<Partial<TextItemLike>>): PageText {
  const out: PageTextItem[] = [];
  let text = '';
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    const eol = item.hasEOL ? '\n' : '';
    out.push({
      str: item.str,
      offset: text.length,
      length: item.str.length + eol.length,
      x: item.transform?.[4] ?? 0,
      y: item.transform?.[5] ?? 0,
    });
    text += item.str + eol;
  }
  return { text, items: out };
}

/** Index of the item that holds `offset` (a point between characters belongs to the item that starts there). */
export function itemAtOffset(items: readonly PageTextItem[], offset: number): number {
  if (items.length === 0) return -1;
  let lo = 0;
  let hi = items.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((items[mid] as PageTextItem).offset <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface ItemSpan {
  readonly index: number;
  /** Character range inside the item's own string. */
  readonly from: number;
  readonly to: number;
}

/** The pieces of items covered by `[start, end)` in the page string (for drawing a highlight on the text layer). */
export function spansForRange(items: readonly PageTextItem[], start: number, end: number): ItemSpan[] {
  const spans: ItemSpan[] = [];
  if (end <= start) return spans;
  for (let i = Math.max(0, itemAtOffset(items, start)); i < items.length; i++) {
    const item = items[i] as PageTextItem;
    if (item.offset >= end) break;
    const from = Math.max(0, start - item.offset);
    const to = Math.min(item.str.length, end - item.offset);
    if (to > from) spans.push({ index: i, from, to });
  }
  return spans;
}

/** Page-string offset for a character `charOffset` inside item `index` (clamped to the item's own text). */
export function offsetOfItemChar(items: readonly PageTextItem[], index: number, charOffset: number): number {
  const item = items[index];
  if (!item) return items.length ? ((items[items.length - 1] as PageTextItem).offset + (items[items.length - 1] as PageTextItem).length) : 0;
  return item.offset + Math.min(Math.max(charOffset, 0), item.str.length);
}
