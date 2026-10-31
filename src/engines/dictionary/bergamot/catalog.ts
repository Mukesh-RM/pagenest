import type { DictionaryPackMeta } from '../types';
import generated from './pack-sizes.generated.json';

/** Mozilla Firefox Translations / Bergamot model family (MPL-2.0 engine; model weights CC-BY per model card). */
export const BERGAMOT_ATTRIBUTION =
  'Translations powered by Bergamot and Firefox Translations models (Mozilla). Model data: see firefox-translations-models on GitHub.';

const LICENSE_NEURAL =
  'MPL-2.0 (Bergamot runtime) + CC-BY (Mozilla model weights) + word lexicon fallback where shipped';

const LICENSE_HI =
  'CC BY-SA 4.0 (lexicon sample); Mozilla en↔hi WASM models are not in the public Bergamot registry — word lexicon only';

function displayName(targetLang: string): string {
  const names: Record<string, string> = {
    hi: 'Hindi',
    es: 'Spanish',
    de: 'German',
    fr: 'French',
    ru: 'Russian',
    cs: 'Czech',
    uk: 'Ukrainian',
    et: 'Estonian',
    it: 'Italian',
    pt: 'Portuguese',
    bg: 'Bulgarian',
  };
  return names[targetLang] ?? targetLang.toUpperCase();
}

function buildPack(row: (typeof generated)[number]): DictionaryPackMeta {
  const target = row.targetLang;
  const hasNeural = row.bergamotKeys.length > 0;
  return {
    id: row.id,
    name: `English ↔ ${displayName(target)}`,
    kind: 'translation',
    sourceLang: 'en',
    targetLang: target,
    sizeBytes: row.sizeBytes,
    url: row.lexiconUrl,
    lexiconUrl: row.lexiconUrl,
    bergamotKeys: row.bergamotKeys,
    license: target === 'hi' ? LICENSE_HI : LICENSE_NEURAL,
    attribution: hasNeural ? BERGAMOT_ATTRIBUTION : BERGAMOT_ATTRIBUTION + ' (lexicon fallback for Hindi)',
  };
}

export const TRANSLATE_EN_HI = buildPack(generated[0]!);
export const TRANSLATE_EN_ES = buildPack(generated[1]!);

export const TRANSLATION_PACKS: readonly DictionaryPackMeta[] = generated.map(buildPack);

export function translationPackById(id: string): DictionaryPackMeta | undefined {
  return TRANSLATION_PACKS.find((p) => p.id === id);
}

export function translationPackForLanguage(lang?: string): DictionaryPackMeta {
  const code = lang?.slice(0, 2).toLowerCase();
  if (code && code !== 'en') {
    const hit = TRANSLATION_PACKS.find((p) => p.targetLang === code || p.sourceLang === code);
    if (hit) return hit;
  }
  return TRANSLATE_EN_HI;
}
