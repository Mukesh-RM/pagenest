import type { DictionaryPackMeta } from '../types';

/** Mozilla Firefox Translations / Bergamot model family (MPL-2.0 engine; model weights CC-BY per model card). */
export const BERGAMOT_ATTRIBUTION =
  'Translations powered by Bergamot and Firefox Translations models (Mozilla). Model data: see firefox-translations-models on GitHub.';

export const TRANSLATE_EN_HI: DictionaryPackMeta = {
  id: 'translate-en-hi',
  name: 'English ↔ Hindi',
  kind: 'translation',
  sourceLang: 'en',
  targetLang: 'hi',
  sizeBytes: 36_400,
  url: '/packs/translate-en-hi-lexicon.json',
  license: 'CC BY-SA 4.0 (lexicon sample) + MPL-2.0 (Bergamot runtime when installed)',
  attribution:
    'Sample bilingual lexicon derived from Wiktionary-style entries (CC BY-SA 4.0). Full neural translation uses Firefox Translations en↔hi models (Mozilla, CC-BY where stated on the model card).',
};

export const TRANSLATE_EN_ES: DictionaryPackMeta = {
  id: 'translate-en-es',
  name: 'English ↔ Spanish',
  kind: 'translation',
  sourceLang: 'en',
  targetLang: 'es',
  sizeBytes: 34_800,
  url: '/packs/translate-en-es-lexicon.json',
  license: 'CC BY-SA 4.0 (lexicon sample)',
  attribution: 'Sample bilingual lexicon (CC BY-SA 4.0).',
};

export const TRANSLATION_PACKS: readonly DictionaryPackMeta[] = [TRANSLATE_EN_HI, TRANSLATE_EN_ES];

export function translationPackById(id: string): DictionaryPackMeta | undefined {
  return TRANSLATION_PACKS.find((p) => p.id === id);
}
