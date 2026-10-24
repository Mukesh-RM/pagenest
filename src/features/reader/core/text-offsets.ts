/**
 * Text positions inside a section document (blueprint 7.2: positions are stored by text, never by page).
 * An offset is a UTF-16 index into the concatenated text of all text nodes under `<body>`, skipping `<script>`
 * and `<style>`. The same walk is used for saving positions, searching and showing highlights, so they agree.
 */

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

/** All text nodes of the section body, in reading order. */
export function textNodes(doc: Document): Text[] {
  const root = doc.body ?? doc.documentElement;
  const nodes: Text[] = [];
  const walker = doc.createTreeWalker(root, 0x1 | 0x4, {
    acceptNode(node) {
      if (node.nodeType === 1) return SKIP.has((node as Element).tagName.toUpperCase()) ? 2 /* REJECT */ : 3 /* SKIP */;
      return 1 /* ACCEPT */;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  return nodes;
}

/** The plain text of the section, as the offsets index it. */
export function sectionText(doc: Document): string {
  return textNodes(doc)
    .map((n) => n.nodeValue ?? '')
    .join('');
}

/** Offset of a DOM point (`container`, `offset`) in section text. */
export function offsetOfPoint(doc: Document, container: Node, offset: number): number {
  const nodes = textNodes(doc);
  let sum = 0;
  if (container.nodeType === 3) {
    for (const n of nodes) {
      if (n === container) return sum + Math.min(offset, n.length);
      sum += n.length;
    }
    return sum;
  }
  // Element point: count the text that ends at or before the point.
  const range = doc.createRange();
  range.setStart(doc.body ?? doc.documentElement, 0);
  range.setEnd(container, offset);
  for (const n of nodes) {
    if (range.comparePoint(n, n.length) > 0) break;
    sum += n.length;
  }
  return sum;
}

/** Offsets of a DOM range. */
export function offsetsOfRange(doc: Document, range: Range): { start: number; end: number } {
  return {
    start: offsetOfPoint(doc, range.startContainer, range.startOffset),
    end: offsetOfPoint(doc, range.endContainer, range.endOffset),
  };
}

/** A DOM range for `[start, end)` in section text. Offsets past the end are clamped. */
export function rangeFromOffsets(doc: Document, start: number, end: number): Range {
  const nodes = textNodes(doc);
  const range = doc.createRange();
  const total = nodes.reduce((s, n) => s + n.length, 0);
  const a = Math.max(0, Math.min(start, total));
  const b = Math.max(a, Math.min(end, total));
  let sum = 0;
  let startSet = false;
  for (const n of nodes) {
    const next = sum + n.length;
    if (!startSet && a < next) {
      range.setStart(n, a - sum);
      startSet = true;
    }
    if (startSet && b <= next) {
      range.setEnd(n, b - sum);
      return range;
    }
    sum = next;
  }
  const last = nodes[nodes.length - 1];
  if (!last) {
    range.selectNodeContents(doc.body ?? doc.documentElement);
    range.collapse(true);
    return range;
  }
  if (!startSet) range.setStart(last, last.length);
  range.setEnd(last, last.length);
  return range;
}

interface Edge {
  /** Index of the character in its text node. */
  readonly index: number;
  readonly left: number;
}

/** The first character at or after `index` (or before it, with step -1) that has a box, so is not collapsed white space. */
function edgeAt(doc: Document, node: Text, index: number, step: 1 | -1 = 1): Edge | undefined {
  const probe = doc.createRange();
  if (typeof probe.getClientRects !== 'function') return undefined; // no layout engine (a test DOM)
  for (let n = 0, i = index; n < 64 && i >= 0 && i < node.length; n++, i += step) {
    probe.setStart(node, i);
    probe.setEnd(node, i + 1);
    const rect = probe.getClientRects()[0];
    if (rect && rect.width > 0) return { index: i, left: rect.left };
  }
  return undefined;
}

/**
 * The text offset of the first character that is on the visible page, where a paginated left-to-right view shows the
 * columns from `pageStart` on. An e-book engine reports the visible range by text node or element, so a paragraph that
 * began on the page before would otherwise save the start of that paragraph and reopen one page too early. Characters
 * run left to right through the columns, so the first text node at or after the range start that reaches the page edge
 * is found, then a binary search inside it finds the first character at or after the edge. The answer is always a
 * character that has a box (never collapsed white space), so the engine can scroll back to it. Returns the range's own
 * start when it cannot tell.
 */
export function firstVisibleOffset(doc: Document, range: Range, pageStart: number, pageEnd = Number.POSITIVE_INFINITY): number {
  const own = offsetOfPoint(doc, range.startContainer, range.startOffset);
  return findFirstVisibleOffset(doc, own, pageStart, pageEnd) ?? own;
}

/** `firstVisibleOffset` looking from text offset `from` on; undefined when no character with a box is on the page. */
export function findFirstVisibleOffset(doc: Document, from_: number, pageStart: number, pageEnd = Number.POSITIVE_INFINITY): number | undefined {
  const own = from_;
  const onPage = (edge: Edge | undefined): boolean => edge !== undefined && edge.left >= pageStart - 1;
  let before = 0;
  for (const node of textNodes(doc)) {
    const nodeStart = before;
    before += node.length;
    if (nodeStart + node.length <= own) continue;
    const from = Math.max(0, own - nodeStart);
    const last = edgeAt(doc, node, node.length - 1, -1);
    if (!last) continue; // white space only
    if (!onPage(last)) continue; // this node ends before the page
    const first = edgeAt(doc, node, from);
    if (!first) continue;
    if (first.left >= pageEnd) return undefined; // nothing on this page but pictures
    if (onPage(first)) return nodeStart + first.index;
    let lo = from;
    let hi = node.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const edge = edgeAt(doc, node, mid);
      if (!edge || onPage(edge)) hi = mid;
      else lo = mid + 1;
    }
    const found = edgeAt(doc, node, Math.min(lo, node.length - 1));
    return nodeStart + (found?.index ?? Math.min(lo, node.length - 1));
  }
  return undefined;
}
