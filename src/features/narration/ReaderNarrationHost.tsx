import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BookScreenProps } from '@/app/components/BookSummary';
import type { ReaderDocumentExt } from '@/features/reader/core/ext-types';
import { sectionText } from '@/features/reader/core/text-offsets';
import { useAudioController } from '@/features/player/PlayerProvider';
import type { VoiceInfo } from '@/engines/tts/types';
import { buildNarrationPlan } from '@/engines/emotion/pipeline';
import { createPiperEngine } from '@/engines/tts/piper/piper-engine';
import { PIPER_DEFAULT_VOICE } from '@/engines/tts/piper/voices';
import { NarrationControls } from './NarrationControls';
import { NarrationSheet } from './NarrationSheet';
import { NarrationSession } from './narration-session';
import { applySentenceHighlights, clearSentenceHighlights, scrollSentenceIntoView } from './sentence-highlight';
import { DEFAULT_NARRATION_SETTINGS, type NarrationSettings } from './types';

export interface ReaderNarrationHostProps {
  readonly book: BookScreenProps['book'];
  readonly doc: ReaderDocumentExt;
  readonly hostRef: React.RefObject<HTMLDivElement | null>;
}

export default function ReaderNarrationHost({ book, doc, hostRef }: ReaderNarrationHostProps) {
  const audio = useAudioController();
  const [settings, setSettings] = useState<NarrationSettings>(DEFAULT_NARRATION_SETTINGS);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voices, setVoices] = useState<readonly VoiceInfo[]>([]);
  const [playing, setPlaying] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [active, setActive] = useState(-1);
  const sessionRef = useRef<NarrationSession>();

  const engine = useMemo(() => {
    const models = new Map<string, ArrayBuffer>();
    return createPiperEngine({
      readModel: async (id) => models.get(id),
      writeModel: async (id, data) => {
        models.set(id, data);
      },
      createWorker: () => new Worker(new URL('../../engines/tts/piper/piper.worker.ts', import.meta.url), { type: 'module' }),
    });
  }, []);

  useEffect(() => {
    void engine.listVoices(book.language?.slice(0, 2) ?? 'en').then(setVoices);
    return () => {
      void engine.dispose();
    };
  }, [book.language, engine]);

  useEffect(() => {
    sessionRef.current = new NarrationSession({ engine, audio });
    return () => sessionRef.current?.stop();
  }, [engine, audio]);

  const chapterText = useMemo(() => {
    const el = hostRef.current?.querySelector('section, body, .foliate-view') ?? hostRef.current;
    if (el instanceof HTMLElement && el.ownerDocument) return sectionText(el.ownerDocument);
    return '';
  }, [doc, hostRef]);

  const plan = useMemo(() => buildNarrationPlan(chapterText, settings.style), [chapterText, settings.style]);

  useEffect(() => {
    const viewDoc = hostRef.current?.querySelector('iframe')?.contentDocument ?? hostRef.current?.ownerDocument;
    if (!viewDoc || !plan.length) return;
    applySentenceHighlights(viewDoc, plan, active);
    if (active >= 0) scrollSentenceIntoView(viewDoc, active);
    return () => clearSentenceHighlights(viewDoc);
  }, [active, hostRef, plan]);

  const sync = useCallback(() => {
    const st = sessionRef.current?.getState();
    if (!st) return;
    setPlaying(st.playing);
    setPreparing(st.preparing);
    setActive(st.activeSentence);
  }, []);

  const onPlayPause = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    if (playing) {
      session.pause();
      sync();
      return;
    }
    setPreparing(true);
    try {
      await session.prepare(book.id, book.title, chapterText, Math.max(0, active));
      session.configure({ ...settings, voiceId: settings.voiceId || PIPER_DEFAULT_VOICE });
      await session.playFromUserGesture(Math.max(0, active));
    } finally {
      sync();
      setPreparing(false);
    }
  }, [active, book.id, book.title, chapterText, playing, settings, sync]);

  return (
    <>
      <NarrationControls
        settings={settings}
        playing={playing}
        preparing={preparing}
        onPlayPause={() => void onPlayPause()}
        onSpeed={(speed) => setSettings((s) => ({ ...s, speed }))}
        onVoice={() => setVoiceOpen(true)}
        onExpressive={(expressive) => setSettings((s) => ({ ...s, expressive, style: expressive ? 'expressive' : 'natural' }))}
      />
      <NarrationSheet
        open={voiceOpen}
        voices={voices}
        selectedId={settings.voiceId}
        onClose={() => setVoiceOpen(false)}
        onPick={(voiceId) => setSettings((s) => ({ ...s, voiceId }))}
      />
    </>
  );
}
