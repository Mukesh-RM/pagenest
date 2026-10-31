import { describe, expect, it, vi } from 'vitest';
import type { ReaderDocumentExt } from '../core/ext-types';
import { makeRange } from '../core/ranges';
import { applyHighlights, collectSearchHits } from './marks';

const range = makeRange(0, 1, 4);

describe('reader marks helpers', () => {
  it('applies stored highlights to the document', () => {
    const doc = { showHighlight: vi.fn() } as unknown as ReaderDocumentExt;
    applyHighlights(doc, [{ id: 'h1', bookId: 'b', range, text: 'hi', color: 'yellow', createdAt: 1 }]);
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
});
