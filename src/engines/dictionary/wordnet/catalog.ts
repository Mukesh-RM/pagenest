import type { DictionaryPackMeta } from '../types';

/** Princeton WordNet 3.1 — WordNet License (permissive, attribution required). */
export const WORDNET_ATTRIBUTION =
  'WordNet® 3.1 Copyright © 2010 by Princeton University. WordNet is a registered trademark of Princeton University. https://wordnet.princeton.edu/license-and-commercial-use';

/** Compact starter pack for tests and quick try (same JSON as before). */
export const WORDNET_EN_CORE: DictionaryPackMeta = {
  id: 'wordnet-en-core',
  name: 'English definitions (WordNet starter)',
  kind: 'definitions',
  sizeBytes: 48_200,
  url: '/packs/wordnet-en-core.json',
  license: 'WordNet License',
  attribution: WORDNET_ATTRIBUTION,
  format: 'json',
};

/** Full WordNet 3.1 glosses (~147k lemmas), WNPK v1 gzip. */
export const WORDNET_EN_FULL: DictionaryPackMeta = {
  id: 'wordnet-en-full',
  name: 'English definitions (WordNet full)',
  kind: 'definitions',
  sizeBytes: 6_944_575,
  url: '/packs/wordnet-en-full.wnpk.gz',
  license: 'WordNet License',
  attribution: WORDNET_ATTRIBUTION,
  format: 'wnpk-gz',
};

export const DEFINITION_PACKS: readonly DictionaryPackMeta[] = [WORDNET_EN_FULL, WORDNET_EN_CORE];

export const PREFERRED_DEFINITION_PACK = WORDNET_EN_FULL;

export function definitionPackById(id: string): DictionaryPackMeta | undefined {
  return DEFINITION_PACKS.find((p) => p.id === id);
}
