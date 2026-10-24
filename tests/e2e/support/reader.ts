import type { Page } from '@playwright/test';

/** Copy that means "nothing here yet". Any of these on a screen that should show a book's text is a failed gate. */
export const PLACEHOLDER_COPY = /arrives? in a later release|coming soon|not (yet )?available|under construction|placeholder|lorem ipsum|\bTODO\b|\bTBD\b|will be used when it does/i;

export interface ReaderTextReport {
  /** Prose paragraphs found: text blocks of 80+ characters outside buttons, navigation, headers and dialogs. */
  paragraphs: number;
  proseChars: number;
  words: number;
  /** Share of words that are plain letters (real text, not ids, numbers or markup). */
  alphaShare: number;
  placeholder: string | null;
  sample: string;
}

/** What the reader on screen really shows: visible prose, measured in the page, plus any placeholder copy. */
export async function readerTextReport(page: Page): Promise<ReaderTextReport> {
  return page.evaluate((placeholderSource) => {
    const placeholder = new RegExp(placeholderSource, 'i');
    const visible = (el: Element) => {
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 20 && r.height > 8 && !el.closest('[aria-hidden="true"]');
    };
    const blocks: string[] = [];
    for (const el of document.querySelectorAll('p, div, section, article, span')) {
      if (!visible(el) || el.closest('button, nav, header, footer, [role="dialog"], [role="status"], [role="toolbar"], h1, h2, h3')) continue;
      // a block's own text: text nodes directly inside it (so a wrapper does not count its children twice)
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join(' ').replace(/\s+/g, ' ').trim();
      if (own.length >= 80) blocks.push(own);
    }
    const prose = blocks.join(' ');
    const words = prose.split(/\s+/).filter(Boolean);
    const all = (document.body.innerText || '').replace(/\s+/g, ' ');
    return {
      paragraphs: blocks.length,
      proseChars: prose.length,
      words: words.length,
      alphaShare: words.length ? words.filter((w) => /^[\p{L}][\p{L}'’-]*[.,;:!?”"')]*$/u.test(w)).length / words.length : 0,
      placeholder: placeholder.exec(all)?.[0] ?? null,
      sample: prose.slice(0, 160),
    };
  }, PLACEHOLDER_COPY.source);
}

/** Minimums for "the sample book opened on real text": about a page of prose. */
export const REAL_TEXT = { minParagraphs: 3, minProseChars: 800, minWords: 120, minAlphaShare: 0.8 } as const;

/** Why the report is not real book text, or null if it is. */
export function whyNotRealText(r: ReaderTextReport): string | null {
  if (r.placeholder) return `placeholder copy on screen: "${r.placeholder}"`;
  if (r.paragraphs < REAL_TEXT.minParagraphs) return `only ${r.paragraphs} paragraph(s) of prose (need ${REAL_TEXT.minParagraphs})`;
  if (r.proseChars < REAL_TEXT.minProseChars) return `only ${r.proseChars} characters of prose (need ${REAL_TEXT.minProseChars})`;
  if (r.words < REAL_TEXT.minWords) return `only ${r.words} words (need ${REAL_TEXT.minWords})`;
  if (r.alphaShare < REAL_TEXT.minAlphaShare) return `only ${(r.alphaShare * 100).toFixed(0)}% of the words are plain text (need ${REAL_TEXT.minAlphaShare * 100}%): not prose`;
  return null;
}
