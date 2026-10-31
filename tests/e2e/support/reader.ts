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

function mergeReports(a: ReaderTextReport, b: ReaderTextReport): ReaderTextReport {
  const words = a.words + b.words;
  const alphaShare = words ? (a.alphaShare * a.words + b.alphaShare * b.words) / words : 0;
  return {
    paragraphs: a.paragraphs + b.paragraphs,
    proseChars: a.proseChars + b.proseChars,
    words,
    alphaShare,
    placeholder: a.placeholder ?? b.placeholder,
    sample: a.sample.length >= b.sample.length ? a.sample : b.sample,
  };
}

const scanBodyText = (placeholderSource: string) => {
  const placeholder = new RegExp(placeholderSource, 'i');
  const bodyText = (document.body?.innerText ?? '').replace(/\r/g, '');
  const blocks = bodyText
    .split(/\n+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 40);
  const prose = blocks.join(' ');
  const words = prose.split(/\s+/).filter(Boolean);
  const all = bodyText.replace(/\s+/g, ' ');
  return {
    paragraphs: blocks.length,
    proseChars: prose.length,
    words: words.length,
    alphaShare: words.length ? words.filter((w) => /^[\p{L}][\p{L}'’-]*[.,;:!?”"')]*$/u.test(w)).length / words.length : 0,
    placeholder: placeholder.exec(all)?.[0] ?? null,
    sample: prose.slice(0, 160),
  };
};

/** What the reader on screen really shows: foliate blob document text, or visible HTML prose in harness pages. */
export async function readerTextReport(page: Page): Promise<ReaderTextReport> {
  const empty: ReaderTextReport = { paragraphs: 0, proseChars: 0, words: 0, alphaShare: 0, placeholder: null, sample: '' };
  let merged = empty;
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      merged = mergeReports(merged, await frame.evaluate(scanBodyText, PLACEHOLDER_COPY.source));
    } catch {
      // frame may detach while paginating
    }
  }
  if (merged.proseChars > 0) return merged;

  return page.evaluate((placeholderSource) => {
    const placeholder = new RegExp(placeholderSource, 'i');
    const visible = (el: Element) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 20 && r.height > 8 && !el.closest('[aria-hidden="true"]');
    };
    const blocks: string[] = [];
    for (const el of document.querySelectorAll('p, div, section, article, span')) {
      if (!visible(el) || el.closest('button, nav, header, footer, [role="dialog"], [role="status"], [role="toolbar"], h1, h2, h3')) continue;
      const text = (el instanceof HTMLElement ? el.innerText : el.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      if (text.length < 80) continue;
      const childBlock = el.querySelector('p, div, section, article');
      if (childBlock && childBlock !== el && (childBlock.textContent ?? '').trim().length >= 80) continue;
      blocks.push(text);
    }
    const prose = blocks.join(' ');
    const words = prose.split(/\s+/).filter(Boolean);
    const all = (document.body?.innerText || '').replace(/\s+/g, ' ');
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
