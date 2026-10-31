import { describe, expect, it } from 'vitest';
import { loadLexiconPack, translateWithLexicon } from '@/engines/dictionary/bergamot/lexicon-translate';
import hi from '@/features/dictionary/fixtures/translate-en-hi-mini.json';

describe('lexicon translation', () => {
  const pack = loadLexiconPack(JSON.stringify(hi));

  it('translates en to hi', () => {
    const r = translateWithLexicon(pack, 'hello', 'en', 'hi');
    expect(r.engine).toBe('lexicon');
    expect(r.translation).toBe('नमस्ते');
  });

  it('translates hi to en', () => {
    const r = translateWithLexicon(pack, 'नमस्ते', 'hi', 'en');
    expect(r.translation).toBe('hello');
  });
});
