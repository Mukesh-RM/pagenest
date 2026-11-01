import { describe, expect, it, vi } from 'vitest';
import { ensureReadableStart } from './open-position';
import type { ReaderDocumentExt } from '../core/ext-types';

function mockDoc(toc: ReaderDocumentExt['toc']): ReaderDocumentExt {
  return {
    layout: 'reflow',
    toc,
    goTo: vi.fn(async () => undefined),
  } as unknown as ReaderDocumentExt;
}

describe('ensureReadableStart', () => {
  it('does nothing when the host already shows text', async () => {
    const host = document.createElement('div');
    host.innerText = 'Once upon a time there was a rabbit who lived in a burrow under a big fir tree.';
    const doc = mockDoc([]);
    await ensureReadableStart(doc, host);
    expect(doc.goTo).not.toHaveBeenCalled();
  });

  it('jumps to the first non-cover chapter when the opening page is empty', async () => {
    const host = document.createElement('div');
    const doc = mockDoc([
      { title: 'Cover', locator: { kind: 'reflow', section: 0, textOffset: 0 } },
      { title: 'Chapter 1', locator: { kind: 'reflow', section: 1, textOffset: 0 } },
    ]);
    await ensureReadableStart(doc, host);
    expect(doc.goTo).toHaveBeenCalled();
  });
});
