import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BookScreenProps } from '@/app/components/BookSummary';
import type { ReaderDocumentExt } from '@/features/reader/core/ext-types';
import { useAudioController } from '@/features/player/PlayerProvider';
import { usePlayerStore } from '@/features/player/audio-store';
import { DriveModeOverlay } from '@/features/drive-mode/DriveModeOverlay';
import { SharedSleepTimerSheet } from '@/features/playback/SharedSleepTimerSheet';
import { formatClock } from '@/engines/audio/util';
import type { VoiceEngine, VoiceInfo } from '@/engines/tts/types';
import { buildNarrationPlan } from '@/engines/emotion/pipeline';
import { createNarrationVoiceEngine } from '@/engines/tts';
import { createPiperModelStore } from '@/engines/tts/piper/model-store';
import { PIPER_DEFAULT_VOICE } from '@/engines/tts/piper/voices';
import { getDb } from '@/data/db';
import { createFileStore } from '@/data/opfs';
import { readChapterText } from './chapter-text';
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

function formatNarrationError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Read aloud failed. Try again or pick another voice.';
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
  const [error, setError] = useState<string>();
  const [active, setActive] = useState(-1);
  const [chapterText, setChapterText] = useState('');
  const [engine, setEngine] = useState<VoiceEngine>();
  const sessionRef = useRef<NarrationSession>();
  const db = useMemo(() => getDb(), []);

  useEffect(() => {
    let cancelled = false;
    void createFileStore().then((files) => {
      if (cancelled) return;
      const piperStore = createPiperModelStore(files);
      const eng = createNarrationVoiceEngine(
        {
          readModel: piperStore.readModel,
          writeModel: piperStore.writeModel,
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

  useEffect(() => {
    if (!doc) return undefined;
    const refresh = (): void => setChapterText(readChapterText(hostRef));
    refresh();
    const id = window.setInterval(refresh, 500);
    return () => window.clearInterval(id);
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
    setError(undefined);
    setPreparing(true);
    setPrepMessage(undefined);
    try {
      const text = readChapterText(hostRef);
      const voice = voices.find((v) => v.id === settings.voiceId);
      session.configure({
        ...settings,
        engine: voice?.isOwnVoice ? 'helper' : 'piper',
        voiceId: settings.voiceId || PIPER_DEFAULT_VOICE,
      });
      await session.prepare(book.id, book.title, text, Math.max(0, active), (msg) => setPrepMessage(msg));
      await session.playFromUserGesture(Math.max(0, active));
    } catch (err) {
      sessionRef.current?.pause();
      setError(formatNarrationError(err));
    } finally {
      sync();
      setPreparing(false);
      setPrepMessage(undefined);
    }
  }, [active, book.id, book.title, hostRef, playing, settings, sync, voices]);

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
        error={error}
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
        onPick={(voiceId, engineId) => {
          setError(undefined);
          setSettings((s) => ({ ...s, voiceId, engine: engineId }));
        }}
      />
    </>
  );
}
