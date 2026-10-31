import type { DictionaryPackMeta } from '../types';

/** Princeton WordNet 3.1 — WordNet License (permissive, attribution required). */
export const WORDNET_ATTRIBUTION =
  'WordNet® 3.1 Copyright © 2010 by Princeton University. WordNet is a registered trademark of Princeton University. https://wordnet.princeton.edu/license-and-commercial-use';

/** Core English gloss pack (compact subset). Full pack URL can replace the same id later. */
export const WORDNET_EN_CORE: DictionaryPackMeta = {
  id: 'wordnet-en-core',
  name: 'English definitions (WordNet core)',
  kind: 'definitions',
  sizeBytes: 48_200,
  url: '/packs/wordnet-en-core.json',
  license: 'WordNet License',
  attribution: WORDNET_ATTRIBUTION,
};

export const DEFINITION_PACKS: readonly DictionaryPackMeta[] = [WORDNET_EN_CORE];
