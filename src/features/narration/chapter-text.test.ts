import { describe, expect, it } from 'vitest';
import { readNarrationSourceText } from './chapter-text';

describe('readNarrationSourceText', () => {
  it('reads PDF text layers when layout is fixed', () => {
    const host = document.createElement('div');
    const layer = document.createElement('div');
    layer.className = 'pn-pdf-text textLayer';
    layer.textContent = 'Down the rabbit hole.';
    host.append(layer);
    const ref = { current: host };
    expect(readNarrationSourceText(ref, { layout: 'fixed' } as never)).toContain('rabbit');
  });
});
