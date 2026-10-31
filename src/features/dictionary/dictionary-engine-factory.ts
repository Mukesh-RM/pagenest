import type { DataClient } from '@/data/data-client';
import type { DefinitionSense, DictionaryPackMeta, PackProgress } from '@/engines/dictionary/types';
import { dictionaryError } from '@/engines/dictionary/errors';
import { loadLexiconPack, translateWithLexicon, type LexiconPackJson } from '@/engines/dictionary/bergamot/lexicon-translate';
import {
  TRANSLATION_PACKS,
  translationPackById,
  translationPackForLanguage,
} from '@/engines/dictionary/bergamot/catalog';
import {
  DEFINITION_PACKS,
  PREFERRED_DEFINITION_PACK,
  definitionPackById,
} from '@/engines/dictionary/wordnet/catalog';
import { loadWordnetPack, lookupWordnet, normalizeWord } from '@/engines/dictionary/wordnet/lexicon';
import { maybeGunzip, openWordnetPack, type WordnetIndex } from '@/engines/dictionary/wordnet/wnpk';
import type { DefinitionResult, DictionaryEngine, TranslationResult } from '@/engines/dictionary/types';
import { definitionPackPath, lexiconPackPath } from '@/engines/dictionary/pack-paths';
import type { BergamotRegistry } from '@/engines/dictionary/bergamot/registry-types';
import { ensureBergamotModelsOnDevice, bergamotModelsOnDevice } from '@/engines/dictionary/bergamot/model-store';
import { translateWithBergamot } from '@/engines/dictionary/bergamot/runtime';

function isMockPackMode(): boolean {
  try {
    return import.meta.env.VITE_PN_MOCK_DICTIONARY === '1' || import.meta.env.MODE === 'test';
  } catch {
    return false;
  }
}

function isMockBergamotMode(): boolean {
  try {
    return import.meta.env.VITE_PN_MOCK_BERGAMOT === '1' || import.meta.env.MODE === 'test';
  } catch {
    return false;
  }
}

/** Embedded mini packs for unit tests (not shipped in production bundles). */
export async function testDefinitionBytes(): Promise<ArrayBuffer> {
  const mod = await import('@/features/dictionary/fixtures/wordnet-en-mini.json?raw');
  return new TextEncoder().encode(mod.default).buffer;
}

export async function testTranslationBytes(pair: string): Promise<ArrayBuffer | undefined> {
  if (pair === 'translate-en-hi') {
    const mod = await import('@/features/dictionary/fixtures/translate-en-hi-mini.json?raw');
    return new TextEncoder().encode(mod.default).buffer;
  }
  return undefined;
}

async function downloadPack(
  meta: DictionaryPackMeta,
  url: string,
  options?: { signal?: AbortSignal; onProgress?: (p: PackProgress) => void },
): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal: options?.signal });
  if (!res.ok) throw dictionaryError('download-failed', `Could not download ${meta.name}.`);
  const total = Number(res.headers.get('content-length') || meta.sizeBytes);
  const reader = res.body?.getReader();
  if (!reader) return res.arrayBuffer();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    options?.onProgress?.({ received, total });
  }
  const out = new Uint8Array(received);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out.buffer;
}

let bergamotRegistryPromise: Promise<BergamotRegistry> | undefined;

async function loadBergamotRegistry(): Promise<BergamotRegistry> {
  if (!bergamotRegistryPromise) {
    bergamotRegistryPromise = fetch('/packs/bergamot-registry.json', { credentials: 'omit' }).then((r) => {
      if (!r.ok) throw dictionaryError('download-failed', 'Could not load translation model registry.');
      return r.json() as Promise<BergamotRegistry>;
    });
  }
  return bergamotRegistryPromise;
}

function loadLexiconForMeta(meta: DictionaryPackMeta, bytes: ArrayBuffer): LexiconPackJson {
  const pack = loadLexiconPack(bytes);
  if (pack.pair === 'en-xx' && meta.targetLang) {
    return { ...pack, pair: `en-${meta.targetLang}` };
  }
  return pack;
}

export function createDictionaryEngine(deps: {
  readonly data: DataClient;
  readonly defaultTranslationPair?: string;
}): DictionaryEngine {
  let wordnetIndex: WordnetIndex | undefined;
  let definitionJson: Map<string, DefinitionSense[]> | undefined;
  let loadedDefinitionPackId: string | undefined;
  const lexicons = new Map<string, LexiconPackJson>();
  const bergamotReady = new Set<string>();
  const defaultPair = deps.defaultTranslationPair ?? 'translate-en-hi';

  const readDefinitionBytes = async (packId: string): Promise<ArrayBuffer | undefined> => {
    const meta = definitionPackById(packId);
    if (!meta) return undefined;
    try {
      return await (await deps.data.openFile(definitionPackPath(meta))).arrayBuffer();
    } catch {
      return undefined;
    }
  };

  const writeDefinitionBytes = async (meta: DictionaryPackMeta, data: ArrayBuffer): Promise<void> => {
    await deps.data.writeFile(definitionPackPath(meta), data);
  };

  const readLexiconBytes = async (packId: string): Promise<ArrayBuffer | undefined> => {
    try {
      return await (await deps.data.openFile(lexiconPackPath(packId))).arrayBuffer();
    } catch {
      return undefined;
    }
  };

  const writeLexiconBytes = async (packId: string, data: ArrayBuffer): Promise<void> => {
    await deps.data.writeFile(lexiconPackPath(packId), data);
  };

  const loadDefinitionsFromBytes = async (meta: DictionaryPackMeta, bytes: ArrayBuffer): Promise<void> => {
    if (meta.format === 'wnpk' || meta.format === 'wnpk-gz') {
      const raw = meta.format === 'wnpk-gz' ? await maybeGunzip(bytes) : bytes;
      wordnetIndex = openWordnetPack(raw);
      definitionJson = undefined;
    } else {
      definitionJson = loadWordnetPack(bytes);
      wordnetIndex = undefined;
    }
    loadedDefinitionPackId = meta.id;
  };

  const hydrate = async (): Promise<void> => {
    if (!wordnetIndex && !definitionJson) {
      for (const meta of DEFINITION_PACKS) {
        const bytes = await readDefinitionBytes(meta.id);
        if (bytes) {
          await loadDefinitionsFromBytes(meta, bytes);
          break;
        }
      }
    }
    for (const meta of TRANSLATION_PACKS) {
      if (lexicons.has(meta.id)) continue;
      const bytes = await readLexiconBytes(meta.id);
      if (bytes) {
        lexicons.set(meta.id, loadLexiconForMeta(meta, bytes));
        const keys = meta.bergamotKeys ?? [];
        if (keys.length === 0) bergamotReady.add(meta.id);
        else {
          try {
            const registry = await loadBergamotRegistry();
            if (await bergamotModelsOnDevice(registry, keys, deps.data)) bergamotReady.add(meta.id);
          } catch {
            /* registry fetch may fail offline */
          }
        }
      }
    }
  };

  return {
    id: 'offline-dictionary',
    hydrate,
    isReady: () => Boolean(wordnetIndex || definitionJson),
    isDefinitionPackReady: (packId) => loadedDefinitionPackId === packId,
    listDefinitionPacks: () => DEFINITION_PACKS,
    listTranslationPacks: () => TRANSLATION_PACKS,
    isTranslationReady: (pairId) => {
      const meta = translationPackById(pairId);
      if (!meta) return false;
      if (!lexicons.has(pairId)) return false;
      if (meta.bergamotKeys?.length && !bergamotReady.has(pairId)) return false;
      return true;
    },
    async ensureDefinitionsPack(packId = PREFERRED_DEFINITION_PACK.id, options) {
      const meta = definitionPackById(packId) ?? PREFERRED_DEFINITION_PACK;
      if (loadedDefinitionPackId === meta.id && (wordnetIndex || definitionJson)) return;
      let bytes = await readDefinitionBytes(meta.id);
      if (!bytes && isMockPackMode() && meta.format === 'json') bytes = await testDefinitionBytes();
      if (!bytes) {
        bytes = await downloadPack(meta, meta.url, options);
        await writeDefinitionBytes(meta, bytes);
      }
      await loadDefinitionsFromBytes(meta, bytes);
    },
    define(word: string): DefinitionResult {
      if (wordnetIndex) return wordnetIndex.define(word);
      if (definitionJson) return lookupWordnet(definitionJson, word);
      return { word: normalizeWord(word), senses: [], source: 'none' };
    },
    async ensureTranslationPack(pairId, options) {
      if (this.isTranslationReady(pairId)) return;
      const meta = translationPackById(pairId);
      if (!meta) throw dictionaryError('unsupported', 'That language pack is not available.');
      let lexBytes = await readLexiconBytes(meta.id);
      if (!lexBytes && isMockPackMode()) lexBytes = (await testTranslationBytes(pairId)) ?? undefined;
      if (!lexBytes) {
        const url = meta.lexiconUrl ?? meta.url;
        lexBytes = await downloadPack(meta, url, {
          ...options,
          onProgress: options?.onProgress
            ? (p) => options.onProgress?.({ received: p.received, total: meta.sizeBytes })
            : undefined,
        });
        await writeLexiconBytes(meta.id, lexBytes);
      }
      lexicons.set(meta.id, loadLexiconForMeta(meta, lexBytes));

      const keys = meta.bergamotKeys ?? [];
      if (keys.length) {
        const registry = await loadBergamotRegistry();
        await ensureBergamotModelsOnDevice(registry, keys, deps.data, {
          signal: options?.signal,
          lexiconBytes: lexBytes.byteLength,
          onProgress: options?.onProgress,
        });
      }
      bergamotReady.add(meta.id);
    },
    async translate(text, pairId, sourceLang = 'en'): Promise<TranslationResult> {
      const meta =
        translationPackById(pairId) ?? translationPackById(defaultPair) ?? translationPackForLanguage(sourceLang);
      if (!meta) {
        return { text, translation: '', sourceLang, targetLang: 'hi', engine: 'none' };
      }
      await this.ensureTranslationPack(meta.id);
      const pack = lexicons.get(meta.id)!;
      const targetLang = meta.targetLang ?? 'hi';
      const src = sourceLang.slice(0, 2);
      const tgt = targetLang.slice(0, 2);

      const tryLexicon = (): TranslationResult | undefined => {
        const { translation, engine } = translateWithLexicon(pack, text, src, tgt);
        if (engine !== 'none') {
          return { text, translation, sourceLang: src, targetLang: tgt, engine: 'lexicon' };
        }
        const rev = translateWithLexicon(pack, text, tgt, src);
        if (rev.engine !== 'none') {
          return { text, translation: rev.translation, sourceLang: tgt, targetLang: src, engine: 'lexicon' };
        }
        return undefined;
      };

      const singleWord = !/\s/.test(text.trim());
      if (singleWord) {
        const lex = tryLexicon();
        if (lex) return lex;
      }

      if (isMockBergamotMode() && !singleWord) {
        return { text, translation: `[offline] ${text}`, sourceLang: src, targetLang: tgt, engine: 'bergamot' };
      }

      if (meta.bergamotKeys?.length) {
        let neural = await translateWithBergamot(deps.data, src, tgt, text);
        if (!neural) neural = await translateWithBergamot(deps.data, tgt, src, text);
        if (neural) {
          return { text, translation: neural, sourceLang: src, targetLang: tgt, engine: 'bergamot' };
        }
      }

      const lex = tryLexicon();
      if (lex) return lex;
      return { text, translation: '', sourceLang: src, targetLang: tgt, engine: 'none' };
    },
  };
}
