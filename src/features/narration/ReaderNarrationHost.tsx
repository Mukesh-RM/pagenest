import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BookScreenProps } from '@/app/components/BookSummary';
import type { ReaderDocumentExt } from '@/features/reader/core/ext-types';
import { sectionText } from '@/features/reader/core/text-offsets';
import { useAudioController } from '@/features/player/PlayerProvider';
import { usePlayerStore } from '@/features/player/audio-store';
import { DriveModeOverlay } from '@/features/drive-mode/DriveModeOverlay';
import { SharedSleepTimerSheet } from '@/features/playback/SharedSleepTimerSheet';
import { formatClock } from '@/engines/audio/util';
import type { VoiceEngine, VoiceInfo } from '@/engines/tts/types';
import { buildNarrationPlan } from '@/engines/emotion/pipeline';
import { createNarrationVoiceEngine } from '@/engines/tts';
import { PIPER_DEFAULT_VOICE } from '@/engines/tts/piper/voices';
import { getDb } from '@/data/db';
import { createFileStore } from '@/data/opfs';
import { NarrationDock } from './NarrationDock';
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
  const [sleepOpen, setSleepOpen] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);
  const audioSleep = usePlayerStore((s) => s.state.sleep);
  const [voices, setVoices] = useState<readonly VoiceInfo[]>([]);
  const [playing, setPlaying] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepMessage, setPrepMessage] = useState<string>();
  const [active, setActive] = useState(-1);
  const [engine, setEngine] = useState<VoiceEngine>();
  const sessionRef = useRef<NarrationSession>();
  const db = useMemo(() => getDb(), []);

  useEffect(() => {
    let cancelled = false;
    const models = new Map<string, ArrayBuffer>();
    void createFileStore().then((files) => {
      if (cancelled) return;
      const eng = createNarrationVoiceEngine(
        {
          readModel: async (id) => models.get(id),
          writeModel: async (id, data) => {
            models.set(id, data);
          },
          createWorker: () => new Worker(new URL('../../engines/tts/piper/piper.worker.ts', import.meta.url), { type: 'module' }),
        },
        { db, files },
      );
      setEngine(eng);
      void eng.listVoices(book.language?.slice(0, 2) ?? 'en').then(setVoices);
    });
    return () => {
      cancelled = true;
    };
  }, [book.language, db]);

  useEffect(() => {
    return () => {
      void engine?.dispose();
    };
  }, [engine]);

  useEffect(() => {
    if (!engine) return;
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
    setPrepMessage(undefined);
    try {
      const voice = voices.find((v) => v.id === settings.voiceId);
      session.configure({
        ...settings,
        engine: voice?.isOwnVoice ? 'helper' : 'piper',
        voiceId: settings.voiceId || PIPER_DEFAULT_VOICE,
      });
      await session.prepare(book.id, book.title, chapterText, Math.max(0, active), (msg) => setPrepMessage(msg));
      await session.playFromUserGesture(Math.max(0, active));
    } finally {
      sync();
      setPreparing(false);
      setPrepMessage(undefined);
    }
  }, [active, book.id, book.title, chapterText, playing, settings, sync, voices]);

  const sleepLabel = useMemo(() => {
    if (!audioSleep) return 'Off';
    if (audioSleep.spec.kind === 'endOfChapter') return 'End of chapter';
    if (audioSleep.spec.kind === 'minutes' && audioSleep.spec.minutes) return `${audioSleep.spec.minutes} min`;
    return formatClock(audioSleep.remainingSec);
  }, [audioSleep]);

  return (
    <>
      <NarrationDock
        settings={settings}
        playing={playing}
        preparing={preparing}
        sleepLabel={sleepLabel}
        prepMessage={prepMessage}
        onPlayPause={() => void onPlayPause()}
        onSpeed={(speed) => setSettings((s) => ({ ...s, speed }))}
        onVoice={() => setVoiceOpen(true)}
        onExpressive={(expressive) =>
          setSettings((s) => ({ ...s, expressive, style: expressive ? 'expressive' : s.style === 'cast' ? 'cast' : 'natural' }))
        }
        onCast={(cast) => setSettings((s) => ({ ...s, style: cast ? 'cast' : 'natural', expressive: false }))}
        onSleep={() => setSleepOpen(true)}
        onDriveMode={() => setDriveOpen(true)}
      />
      <SharedSleepTimerSheet open={sleepOpen} onClose={() => setSleepOpen(false)} controller={audio} />
      <DriveModeOverlay open={driveOpen} controller={audio} onClose={() => setDriveOpen(false)} />
      <NarrationSheet
        open={voiceOpen}
        voices={voices}
        selectedId={settings.voiceId}
        onClose={() => setVoiceOpen(false)}
        onPick={(voiceId, engineId) => setSettings((s) => ({ ...s, voiceId, engine: engineId }))}
      />
    </>
  );
}
