import type { ReaderDocumentExt } from './ext-types';
import type { ReaderPosition } from '@/engines/reader/types';

export interface WelcomeBack {
  /** "Welcome back, chapter 7" */
  readonly headline: string;
  /** Chapter title or progress line under the headline. */
  readonly detail: string;
}

/** 1-based chapter number for a progress fraction, from the chapter start ticks (0 when before the first chapter). */
export function chapterNumber(ticks: readonly number[], fraction: number): number {
  let n = 0;
  for (const t of ticks) if (t <= fraction + 1e-6) n += 1;
  return n;
}

/** The quiet card shown when a book opens where the reader left off. `undefined` for a book that was never read. */
export function welcomeBackFor(doc: Pick<ReaderDocumentExt, 'chapterTicks' | 'layout'>, position: ReaderPosition, savedPercent: number): WelcomeBack | undefined {
  if (!(savedPercent > 0.5)) return undefined;
  const percent = Math.round(savedPercent);
  if (doc.layout === 'fixed' && position.page) {
    return { headline: `Welcome back, page ${position.page}`, detail: position.pageCount ? `of ${position.pageCount}, ${percent}% read` : `${percent}% read` };
  }
  const n = chapterNumber(doc.chapterTicks(), savedPercent / 100);
  if (n > 0) return { headline: `Welcome back, chapter ${n}`, detail: position.chapterTitle ?? `${percent}% read` };
  return { headline: 'Welcome back', detail: position.chapterTitle ?? `${percent}% read` };
}
