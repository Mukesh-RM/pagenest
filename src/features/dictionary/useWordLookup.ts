import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useServices } from '@/app/services-context';
import { PREFERRED_DEFINITION_PACK } from '@/engines/dictionary/wordnet/catalog';
import { translationPackForLanguage } from '@/engines/dictionary/bergamot/catalog';
import type { DefinitionResult, TranslationResult } from '@/engines/dictionary/types';
import type { ReaderSelection } from '@/engines/reader/types';
import { createDictionaryEngine } from './dictionary-engine-factory';
import { primaryWord } from './word';

function formatSize(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export interface WordLookupState {
  readonly query: string;
  readonly displayWord: string;
  readonly definition: DefinitionResult | undefined;
  readonly translation: TranslationResult | undefined;
  readonly loading: boolean;
  readonly needsDownload: boolean;
  readonly downloadLabel: string | undefined;
  readonly showLookup: boolean;
  readonly handleDownload: () => void;
  readonly reset: () => void;
}

export function useWordLookup({
  selection,
  wordTap,
  bookLanguage,
  lookupToken,
  lookupMode,
}: {
  readonly selection: ReaderSelection | undefined;
  readonly wordTap?: { readonly token: number; readonly word: string };
  readonly bookLanguage?: string;
  readonly lookupToken: number;
  readonly lookupMode: 'define' | 'translate' | undefined;
}): WordLookupState {
  const { data } = useServices();
  const translationPair = useMemo(() => translationPackForLanguage(bookLanguage), [bookLanguage]);
  const engine = useMemo(
    () => createDictionaryEngine({ data, defaultTranslationPair: translationPair.id }),
    [data, translationPair.id],
  );
  const [query, setQuery] = useState('');
  const [definition, setDefinition] = useState<DefinitionResult | undefined>();
  const [translation, setTranslation] = useState<TranslationResult | undefined>();
  const [loading, setLoading] = useState(false);
  const [needsDownload, setNeedsDownload] = useState(false);
  const [downloadLabel, setDownloadLabel] = useState<string | undefined>();
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    void engine.hydrate();
  }, [engine]);

  const reset = useCallback(() => {
    setQuery('');
    setDefinition(undefined);
    setTranslation(undefined);
    setNeedsDownload(false);
    setDownloadLabel(undefined);
    setLoading(false);
  }, []);

  const runLookup = useCallback(
    async (raw: string, mode: 'define' | 'translate' | 'both') => {
      const defineWord = primaryWord(raw);
      if (!defineWord && !raw.trim()) return;
      const translateText = mode === 'translate' && selection?.text?.trim() ? selection.text.trim() : raw.trim();
      setQuery(translateText || defineWord);
      setDefinition(undefined);
      setTranslation(undefined);
      setNeedsDownload(false);
      setLoading(true);
      try {
        await engine.hydrate();
        const needDef = mode === 'define' || mode === 'both';
        const needTr = mode === 'translate' || mode === 'both';
        if (needDef && !engine.isReady()) {
          setDownloadLabel(`${formatSize(PREFERRED_DEFINITION_PACK.sizeBytes)} · ${PREFERRED_DEFINITION_PACK.license}`);
          setNeedsDownload(true);
          return;
        }
        if (needTr && !engine.isTranslationReady(translationPair.id)) {
          if (import.meta.env.VITE_PN_MOCK_BERGAMOT !== '1') {
            setDownloadLabel(`${formatSize(translationPair.sizeBytes)} · ${translationPair.license}`);
            setNeedsDownload(true);
            return;
          }
        }
        if (needDef && defineWord) setDefinition(engine.define(defineWord));
        if (needTr) {
          setTranslation(
            await engine.translate(translateText, translationPair.id, bookLanguage?.slice(0, 2) ?? 'en'),
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [bookLanguage, engine, selection?.text, translationPair],
  );

  const handleDownload = useCallback(async () => {
    setLoading(true);
    setNeedsDownload(false);
    try {
      await engine.ensureDefinitionsPack();
      await engine.ensureTranslationPack(translationPair.id);
      const mode = lookupMode === 'translate' ? 'translate' : lookupMode === 'define' ? 'define' : 'both';
      await runLookup(query, mode);
    } finally {
      setLoading(false);
    }
  }, [engine, lookupMode, query, runLookup, translationPair.id]);

  useEffect(() => {
    if (!lookupToken || !lookupMode || !selection?.text) return;
    void runLookup(selection.text, lookupMode === 'translate' ? 'translate' : 'define');
  }, [lookupToken, lookupMode, selection?.text, runLookup]);

  useEffect(() => {
    if (!wordTap?.token) return;
    void runLookup(wordTap.word, 'define');
  }, [wordTap?.token, wordTap?.word, runLookup]);

  const displayWord = primaryWord(query) || primaryWord(selection?.text ?? '') || wordTap?.word || 'Selection';
  const showLookup = Boolean(lookupMode && (query || lookupToken));

  return {
    query,
    displayWord,
    definition,
    translation,
    loading,
    needsDownload,
    downloadLabel,
    showLookup,
    handleDownload: () => void handleDownload(),
    reset,
  };
}
