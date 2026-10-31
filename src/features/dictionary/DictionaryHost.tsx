import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useServices } from '@/app/services-context';
import { PREFERRED_DEFINITION_PACK } from '@/engines/dictionary/wordnet/catalog';
import { translationPackForLanguage } from '@/engines/dictionary/bergamot/catalog';
import type { DefinitionResult, TranslationResult } from '@/engines/dictionary/types';
import type { ReaderSelection } from '@/engines/reader/types';
import { createDictionaryEngine } from './dictionary-engine-factory';
import { DictionaryPopup } from './DictionaryPopup';
import { primaryWord, wordAtPoint } from './word';
import './dictionary.css';

export interface DictionaryHostProps {
  readonly hostRef: React.RefObject<HTMLElement | null>;
  readonly selection: ReaderSelection | undefined;
  readonly bookLanguage?: string;
  readonly lookupToken: number;
  readonly lookupMode: 'define' | 'translate' | undefined;
  readonly onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export default function DictionaryHost({
  hostRef,
  selection,
  bookLanguage,
  lookupToken,
  lookupMode,
  onClose,
}: DictionaryHostProps) {
  const { data } = useServices();
  const translationPair = useMemo(() => translationPackForLanguage(bookLanguage), [bookLanguage]);
  const engine = useMemo(
    () => createDictionaryEngine({ data, defaultTranslationPair: translationPair.id }),
    [data, translationPair.id],
  );
  const [query, setQuery] = useState('');
  const [anchor, setAnchor] = useState<DOMRect | undefined>();
  const [definition, setDefinition] = useState<DefinitionResult | undefined>();
  const [translation, setTranslation] = useState<TranslationResult | undefined>();
  const [loading, setLoading] = useState(false);
  const [needsDownload, setNeedsDownload] = useState(false);
  const [downloadLabel, setDownloadLabel] = useState<string | undefined>();
  const tapRef = useRef<{ x: number; y: number; t: number } | undefined>();
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    void engine.hydrate();
  }, [engine]);

  const runLookup = useCallback(
    async (raw: string, mode: 'define' | 'translate' | 'both', rect?: DOMRect) => {
      const defineWord = primaryWord(raw);
      if (!defineWord && !raw.trim()) return;
      const translateText = mode === 'translate' && selection?.text?.trim() ? selection.text.trim() : raw.trim();
      setQuery(translateText || defineWord);
      setAnchor(rect);
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
          setDownloadLabel(`${formatSize(translationPair.sizeBytes)} · ${translationPair.license}`);
          setNeedsDownload(true);
          return;
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
      await runLookup(query, mode, anchor);
    } finally {
      setLoading(false);
    }
  }, [anchor, engine, lookupMode, query, runLookup, translationPair.id]);

  useEffect(() => {
    if (!lookupToken || !lookupMode || !selection?.text) return;
    const rect = hostRef.current?.getBoundingClientRect();
    void runLookup(selection.text, lookupMode === 'translate' ? 'translate' : 'define', rect);
  }, [lookupToken, lookupMode, selection?.text, runLookup, hostRef]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      tapRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const onPointerUp = (e: PointerEvent) => {
      const start = tapRef.current;
      tapRef.current = undefined;
      if (!start || e.button !== 0) return;
      if (performance.now() - start.t > 450) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) return;
      if (selection?.text) return;
      const hit = wordAtPoint(host.ownerDocument, e.clientX, e.clientY);
      if (!hit) return;
      void runLookup(hit, 'both', new DOMRect(e.clientX - 20, e.clientY - 8, 40, 16));
    };
    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointerup', onPointerUp);
    return () => {
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointerup', onPointerUp);
    };
  }, [hostRef, runLookup, selection?.text]);

  if (!query) return null;

  return (
    <DictionaryPopup
      word={primaryWord(query) || query}
      {...(anchor ? { anchor } : {})}
      {...(definition ? { definition } : {})}
      {...(translation ? { translation } : {})}
      loading={loading}
      needsDownload={needsDownload}
      {...(downloadLabel ? { downloadLabel } : {})}
      onDownload={() => void handleDownload()}
      onClose={() => {
        setQuery('');
        setAnchor(undefined);
        onClose();
      }}
    />
  );
}
