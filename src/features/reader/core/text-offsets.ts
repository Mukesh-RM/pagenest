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
