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
import { createNarrationVoiceEngine, pickDefaultSpeechVoice } from '@/engines/tts';
import { createPiperModelStore } from '@/engines/tts/piper/model-store';
import { getDb } from '@/data/db';
import { createFileStore } from '@/data/opfs';
import { readChapterText } from './chapter-text';
import { NarrationDock } from './NarrationDock';
import { NarrationSheet } from './NarrationSheet';
import { NarrationSession } from './narration-session';
import { applySentenceHighlights, clearSentenceHighlights, scrollSentenceIntoView } from './sentence-highlight';
import { loadNarrationSettings, saveNarrationSettings, type StoredNarrationSettings } from './narration-settings';
import { DEFAULT_NARRATION_SETTINGS } from './types';

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
  const [settings, setSettings] = useState<StoredNarrationSettings>(DEFAULT_NARRATION_SETTINGS);
  const narrationPrefsHydrated = useRef(false);
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
      void eng.listVoices(book.language?.slice(0, 2) ?? 'en').then((list) => {
        if (cancelled) return;
        setVoices(list);
        void loadNarrationSettings(db, list).then((migrated) => {
          if (cancelled) return;
          setSettings(migrated);
          narrationPrefsHydrated.current = true;
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [book.language, db]);

  useEffect(() => {
    if (!narrationPrefsHydrated.current || voices.length === 0) return;
    void saveNarrationSettings(db, settings);
  }, [db, settings, voices.length]);

  useEffect(() => {
    return () => {
      void engine?.dispose();
    };
  }, [engine]);

  useEffect(() => {
    if (!engine) return;
    sessionRef.current = new NarrationSession({
      engine,
      audio,
      onError: (err) => setError(formatNarrationError(err)),
    });
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

  const resolvedVoice = useCallback((): VoiceInfo | undefined => {
    const picked = voices.find((v) => v.id === settings.voiceId);
    if (picked) return picked;
    return pickDefaultSpeechVoice(voices, book.language);
  }, [book.language, settings.voiceId, voices]);

  const onPlayPause = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    if (playing) {
      session.pause();
      sync();
      return;
    }
    if (session.canResumeLive()) {
      session.resumeLive();
      sync();
      return;
    }
    setError(undefined);
    setPreparing(true);
    setPrepMessage(undefined);
    try {
      const text = readChapterText(hostRef);
      const voice = resolvedVoice();
      if (!voice) throw new Error('No read-aloud voice is available on this device.');
      session.configure({
        ...settings,
        engine: voice.engine,
        voiceId: voice.id,
      });
      await session.prepare(book.id, book.title, text, Math.max(0, active), (msg) => setPrepMessage(msg));
      session.playFromUserGesture(Math.max(0, active));
    } catch (err) {
      sessionRef.current?.pause();
      setError(formatNarrationError(err));
    } finally {
      sync();
      setPreparing(false);
      setPrepMessage(undefined);
    }
  }, [active, book.id, book.title, hostRef, playing, resolvedVoice, settings, sync]);

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
        onSpeed={(speed) => {
          setSettings((s) => ({ ...s, speed }));
          sessionRef.current?.configure({ speed });
        }}
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
        selectedId={settings.voiceId || resolvedVoice()?.id || ''}
        onClose={() => setVoiceOpen(false)}
        onPick={(voiceId, engineId) => {
          setError(undefined);
          setSettings((s) => ({
            ...s,
            voiceId,
            engine: engineId,
            hdVoiceExplicit: engineId === 'piper',
          }));
        }}
      />
    </>
  );
}
