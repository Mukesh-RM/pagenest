import { isLocator, type Locator, type ReflowLocator, type TextRange } from '@/app/contracts';

/**
 * Highlight and search ranges are `TextRange`s of reflow locators (blueprint 13: "stored as ranges so they survive
 * re-pagination"):
 *  - EPUB, MOBI, FB2, DOCX, TXT: `section` is the spine index, `textOffset` indexes the section text.
 *  - PDF: `section` is the 0-based page (page number - 1), `textOffset` indexes that page's text layer string.
 *  - CBZ has no text, so it has no ranges.
 */

export function reflowAt(section: number, textOffset: number, cfi?: string): ReflowLocator {
  return { kind: 'reflow', section, textOffset, ...(cfi ? { cfi } : {}) };
}

export function makeRange(section: number, start: number, end: number): TextRange {
  return { start: reflowAt(section, Math.min(start, end)), end: reflowAt(section, Math.max(start, end)) };
}

export function isTextRange(value: unknown): value is TextRange {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return isLocator(v['start']) && isLocator(v['end']) && (v['start'] as Locator).kind === 'reflow' && (v['end'] as Locator).kind === 'reflow';
}

/** Section index and offsets when the whole range sits in one section; `undefined` for a range across sections. */
export function singleSection(range: TextRange): { section: number; start: number; end: number } | undefined {
  const { start, end } = range;
  if (start.kind !== 'reflow' || end.kind !== 'reflow' || start.section !== end.section) return undefined;
  return { section: start.section, start: start.textOffset, end: end.textOffset };
}

/** For each section a range touches: `[section, startOffset, endOffset | Infinity]`. */
export function sectionsOfRange(range: TextRange): Array<{ section: number; start: number; end: number }> {
  const { start, end } = range;
  if (start.kind !== 'reflow' || end.kind !== 'reflow') return [];
  if (start.section === end.section) return [{ section: start.section, start: start.textOffset, end: end.textOffset }];
  const parts = [{ section: start.section, start: start.textOffset, end: Number.POSITIVE_INFINITY }];
  for (let s = start.section + 1; s < end.section; s++) parts.push({ section: s, start: 0, end: Number.POSITIVE_INFINITY });
  parts.push({ section: end.section, start: 0, end: end.textOffset });
  return parts;
}

/** Order two ranges by where they start. */
export function compareRanges(a: TextRange, b: TextRange): number {
  const x = a.start;
  const y = b.start;
  if (x.kind !== 'reflow' || y.kind !== 'reflow') return 0;
  return x.section - y.section || x.textOffset - y.textOffset;
}

export function rangesOverlap(a: TextRange, b: TextRange): boolean {
  const x = a.start;
  const y = b.start;
  const xe = a.end;
  const ye = b.end;
  if (x.kind !== 'reflow' || y.kind !== 'reflow' || xe.kind !== 'reflow' || ye.kind !== 'reflow') return false;
  const before = (p: ReflowLocator, q: ReflowLocator): boolean => p.section < q.section || (p.section === q.section && p.textOffset <= q.textOffset);
  return before(x, ye) && before(y, xe) && !(x.section === ye.section && x.textOffset === ye.textOffset) && !(y.section === xe.section && y.textOffset === xe.textOffset);
}

/** The items whose range touches `section`. */
export function inSection<T extends { range: TextRange }>(items: readonly T[], section: number): T[] {
  return items.filter((i) => sectionsOfRange(i.range).some((p) => p.section === section));
}
