import { describe, expect, it, vi } from 'vitest';
import type { PageNestDB } from '@/data/db';
import type { ReaderDocumentExt } from '../core/ext-types';
import { makeRange } from '../core/ranges';
import {
  applyHighlights,
  clearHighlightNote,
  collectSearchHits,
  deleteHighlight,
  highlightsWithNotes,
  setHighlightNote,
} from './marks';

const range = makeRange(0, 1, 4);
const row = { id: 'h1', bookId: 'b', range, text: 'hello', color: 'yellow' as const, createdAt: 1 };

describe('reader marks helpers', () => {
  it('applies stored highlights to the document', () => {
    const doc = { showHighlight: vi.fn() } as unknown as ReaderDocumentExt;
    applyHighlights(doc, [row]);
    expect(doc.showHighlight).toHaveBeenCalledWith('h1', range, 'yellow');
  });

  it('collects search hits until the limit', async () => {
    async function* gen() {
      yield { range, excerpt: 'one', matchStart: 0, matchEnd: 3 };
      yield { range, excerpt: 'two', matchStart: 0, matchEnd: 3 };
    }
    const doc = { search: () => gen() } as unknown as ReaderDocumentExt;
    const hits = await collectSearchHits(doc, 'x', undefined, 1);
    expect(hits).toHaveLength(1);
  });

  it('lists only highlights that carry a note', () => {
    expect(highlightsWithNotes([row, { ...row, id: 'h2', note: 'idea' }])).toHaveLength(1);
  });

  it('clears a note without removing the highlight', async () => {
    const db = { highlights: { put: vi.fn(async (r) => r) } } as unknown as PageNestDB;
    const next = await clearHighlightNote(db, { ...row, note: 'x' });
    expect(next.note).toBeUndefined();
  });

  it('deletes a highlight from the db and the page', async () => {
    const doc = { hideHighlight: vi.fn() } as unknown as ReaderDocumentExt;
    const db = { highlights: { delete: vi.fn(async () => undefined) } } as unknown as PageNestDB;
    await deleteHighlight(db, doc, row);
    expect(doc.hideHighlight).toHaveBeenCalledWith('h1');
    expect(db.highlights.delete).toHaveBeenCalledWith('h1');
  });

  it('trims note text on save', async () => {
    const db = { highlights: { put: vi.fn(async (r) => r) } } as unknown as PageNestDB;
    const next = await setHighlightNote(db, row, '  spaced  ');
    expect(next.note).toBe('spaced');
  });
});
