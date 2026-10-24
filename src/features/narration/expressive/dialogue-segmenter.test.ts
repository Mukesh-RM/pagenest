// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { segmentNarrationAndDialogue } from './dialogue-segmenter';

describe('segmentNarrationAndDialogue', () => {
  it('splits quoted dialogue', () => {
    const segments = segmentNarrationAndDialogue('She said, "Hello there." Then left.');
    const dialogue = segments.find((s) => s.kind === 'dialogue');
    expect(dialogue?.text).toBe('Hello there.');
  });
});
