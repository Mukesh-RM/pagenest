import type { FileRef } from '@/app/contracts';
import type { DictionaryPackMeta } from './types';

/** OPFS path for a downloaded definitions or lexicon pack body. */
export function definitionPackPath(meta: DictionaryPackMeta): FileRef {
  if (meta.format === 'wnpk-gz') return `dictionaries/${meta.id}.wnpk.gz`;
  if (meta.format === 'wnpk') return `dictionaries/${meta.id}.wnpk`;
  return `dictionaries/${meta.id}.json`;
}

export function lexiconPackPath(packId: string): FileRef {
  return `dictionaries/${packId}-lexicon.json`;
}

/** One Bergamot model blob keyed by its canonical download URL (filename is unique in Mozilla registry). */
export function bergamotModelPath(modelUrl: string): FileRef {
  const base = modelUrl.split('/').pop() ?? 'model.bin';
  return `dictionaries/bergamot/${base}`;
}
