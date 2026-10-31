import { rangeFromOffsets } from '@/features/reader/core/text-offsets';
import type { PlannedSentence } from '@/engines/emotion/types';

const MARK = 'pn-narration-highlight';

/** Wrap each sentence range in the reader DOM with a highlight span. */
export function applySentenceHighlights(doc: Document, plan: readonly PlannedSentence[], active: number): void {
  clearSentenceHighlights(doc);
  for (const sentence of plan) {
    try {
      const range = rangeFromOffsets(doc, sentence.start, sentence.end);
      const span = doc.createElement('span');
      span.className = `${MARK}${sentence.index === active ? ` ${MARK}--active` : ''}`;
      span.dataset.sentenceIndex = String(sentence.index);
      range.surroundContents(span);
    } catch {
      /* complex DOM: skip sentence */
    }
  }
}

export function clearSentenceHighlights(doc: Document): void {
  doc.querySelectorAll(`.${MARK}`).forEach((el) => {
    const parent = el.parentNode;
    while (el.firstChild) parent?.insertBefore(el.firstChild, el);
    el.remove();
  });
}

export function scrollSentenceIntoView(doc: Document, index: number): void {
  const el = doc.querySelector(`.${MARK}[data-sentence-index="${index}"]`);
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
