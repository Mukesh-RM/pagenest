import type { ProgressMode } from './common';

/**
 * The shared position type (blueprint sections 7 and 12.2).
 *
 * Every feature stores and restores a position as a `Locator`, so reading,
 * listening and read-aloud all resume the same way. A locator is plain
 * JSON-compatible data: it survives IndexedDB, backup files and structured clone.
 *
 * Three kinds exist:
 * - `page`: fixed-layout content (PDF, CBZ). 1-based page plus a vertical offset.
 * - `reflow`: reflowable text (EPUB, MOBI, FB2, DOCX, TXT ...). Stored by text
 *   position, not page number, so a font-size change keeps the same sentence.
 * - `audio`: an audiobook position, track index plus seconds into that track.
 */
export type Locator = PageLocator | ReflowLocator | AudioLocator;

/** Discriminant values of {@link Locator}. */
export type LocatorKind = Locator['kind'];

/** Fixed-layout position: a PDF page (or comic page) plus how far down it. */
export interface PageLocator {
  readonly kind: 'page';
  /** 1-based page number. */
  readonly page: number;
  /** Vertical position inside the page, 0 (top) to 1 (bottom). */
  readonly offset: number;
}

/** Reflowable text position, independent of font, margins and screen size. */
export interface ReflowLocator {
  readonly kind: 'reflow';
  /** 0-based index of the spine item / section / chapter file. */
  readonly section: number;
  /** 0-based UTF-16 character offset into the plain text of that section. */
  readonly textOffset: number;
  /**
   * Engine-specific precise location (for example an EPUB CFI). Optional
   * accelerator: when absent or unusable, `section` and `textOffset` decide.
   */
  readonly cfi?: string;
  /** 0-based sentence index inside the section, set by read-aloud mode. */
  readonly sentence?: number;
}

/** Audiobook position. */
export interface AudioLocator {
  readonly kind: 'audio';
  /** 0-based index into the book's tracks (always 0 for one-file M4B). */
  readonly trackIndex: number;
  /** Seconds from the start of that track. */
  readonly positionSec: number;
}

/** A span of content, used for highlights and search hits. `start` is inclusive, `end` exclusive. */
export interface TextRange {
  readonly start: Locator;
  readonly end: Locator;
}

/** Locator kinds that make sense for each progress mode. */
export const LOCATOR_KINDS_BY_MODE: Readonly<Record<ProgressMode, readonly LocatorKind[]>> = {
  read: ['page', 'reflow'],
  listen: ['audio'],
  aloud: ['reflow'],
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInt(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

/**
 * Runtime check for data that came from outside the type system (IndexedDB,
 * a backup file, an engine). Returns true only for well-formed locators.
 */
export function isLocator(value: unknown): value is Locator {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  switch (v['kind']) {
    case 'page':
      return (
        isFiniteNumber(v['page']) &&
        Number.isInteger(v['page']) &&
        v['page'] >= 1 &&
        isFiniteNumber(v['offset']) &&
        v['offset'] >= 0 &&
        v['offset'] <= 1
      );
    case 'reflow':
      return (
        isNonNegativeInt(v['section']) &&
        isNonNegativeInt(v['textOffset']) &&
        (v['cfi'] === undefined || typeof v['cfi'] === 'string') &&
        (v['sentence'] === undefined || isNonNegativeInt(v['sentence']))
      );
    case 'audio':
      return isNonNegativeInt(v['trackIndex']) && isFiniteNumber(v['positionSec']) && v['positionSec'] >= 0;
    default:
      return false;
  }
}

/** True when `locator` is a valid position for `mode`. */
export function isLocatorForMode(locator: Locator, mode: ProgressMode): boolean {
  return LOCATOR_KINDS_BY_MODE[mode].includes(locator.kind);
}

/** Structural equality. Optional fields count: `{cfi: undefined}` equals a missing `cfi`. */
export function locatorsEqual(a: Locator, b: Locator): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'page': {
      const o = b as PageLocator;
      return a.page === o.page && a.offset === o.offset;
    }
    case 'reflow': {
      const o = b as ReflowLocator;
      return (
        a.section === o.section &&
        a.textOffset === o.textOffset &&
        a.cfi === o.cfi &&
        a.sentence === o.sentence
      );
    }
    case 'audio': {
      const o = b as AudioLocator;
      return a.trackIndex === o.trackIndex && a.positionSec === o.positionSec;
    }
  }
}

/**
 * Total order for two locators of the same kind: negative when `a` comes
 * before `b`, 0 when equal, positive when after. Returns `undefined` when the
 * kinds differ (positions in different kinds of content cannot be compared).
 */
export function compareLocators(a: Locator, b: Locator): number | undefined {
  if (a.kind !== b.kind) return undefined;
  switch (a.kind) {
    case 'page': {
      const o = b as PageLocator;
      return a.page - o.page || a.offset - o.offset;
    }
    case 'reflow': {
      const o = b as ReflowLocator;
      return a.section - o.section || a.textOffset - o.textOffset;
    }
    case 'audio': {
      const o = b as AudioLocator;
      return a.trackIndex - o.trackIndex || a.positionSec - o.positionSec;
    }
  }
}

/** Clamp any number into the 0 to 100 percent range; NaN becomes 0. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return value === Infinity ? 100 : 0;
  return Math.min(100, Math.max(0, value));
}
