import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@/ui/styles/screens.css';
import '@/ui/styles/surfaces.css';
import type { PageNestDB } from '@/data/db';
import type { FileStore } from '@/data/opfs';
import type { VoiceRecord } from '@/data/schema';
import { buildConsentPhrase } from './consent/phrases';
import { GUIDED_PROMPTS } from './prompts/guided-prompts';
import {
  createBrowserConsentRecognizer,
  queryMicPermission,
  requestMicStream,
  type ConsentRecognizer,
  type MicPermissionState,
} from './audio/mic-access';
import { loadVoiceRecorder, type VoiceRecorder, type RecordedClip } from './audio/recorder';
import { deleteOwnVoice, listOwnVoices, saveOwnVoicePack } from './data/voice-pack';
import { exportOwnVoiceZip } from './data/export-pack';
import { useVoiceStudioStore } from './store/voice-studio-store';
import { MyVoicesPanel } from './ui/MyVoicesPanel';
import { IntroStep } from './ui/IntroStep';
import { ConsentStep } from './ui/ConsentStep';
import { RecordPromptStep } from './ui/RecordPromptStep';
import { NameVoiceStep } from './ui/NameVoiceStep';

export interface VoiceStudioServices {
  readonly db: PageNestDB;
  readonly files: FileStore;
  /** Test hook: override speech verification (e2e supplies a mock). */
  readonly consentRecognizer?: ConsentRecognizer;
  /** Test hook: skip AudioContext and return tiny WAV clips. */
  readonly testRecorder?: VoiceStudioTestRecorder;
}

export interface VoiceStudioTestRecorder {
  attach(stream: MediaStream): Promise<void>;
  stop(): Promise<RecordedClip>;
  dispose(): Promise<void>;
  setLevelListener(fn: ((level: number) => void) | undefined): void;
}

export interface VoiceStudioAppProps {
  services: VoiceStudioServices;
}

export function VoiceStudioApp({ services }: VoiceStudioAppProps) {
  const step = useVoiceStudioStore((s) => s.step);
  const voices = useVoiceStudioStore((s) => s.voices);
  const consent = useVoiceStudioStore((s) => s.consent);
  const consentVerified = useVoiceStudioStore((s) => s.consentVerified);
  const promptIndex = useVoiceStudioStore((s) => s.promptIndex);
  const promptClips = useVoiceStudioStore((s) => s.promptClips);
  const draftName = useVoiceStudioStore((s) => s.draftName);
  const micLevel = useVoiceStudioStore((s) => s.micLevel);
  const busy = useVoiceStudioStore((s) => s.busy);
  const error = useVoiceStudioStore((s) => s.error);
  const setStep = useVoiceStudioStore((s) => s.setStep);
  const setVoices = useVoiceStudioStore((s) => s.setVoices);
  const setConsent = useVoiceStudioStore((s) => s.setConsent);
  const setConsentClip = useVoiceStudioStore((s) => s.setConsentClip);
  const setPromptIndex = useVoiceStudioStore((s) => s.setPromptIndex);
  const savePromptClip = useVoiceStudioStore((s) => s.savePromptClip);
  const setDraftName = useVoiceStudioStore((s) => s.setDraftName);
  const setMicLevel = useVoiceStudioStore((s) => s.setMicLevel);
  const setBusy = useVoiceStudioStore((s) => s.setBusy);
  const setError = useVoiceStudioStore((s) => s.setError);
  const resetRecordingSession = useVoiceStudioStore((s) => s.resetRecordingSession);

  const [micState, setMicState] = useState<MicPermissionState>('unknown');
  const [recording, setRecording] = useState(false);
  const streamRef = useRef<MediaStream | undefined>();
  const recorderRef = useRef<VoiceRecorder | undefined>();
  const consentAbort = useRef<AbortController | undefined>();
  const consentMatchedRef = useRef(false);
  const consentClip = useVoiceStudioStore((s) => s.consentClip);
  const recognitionRef = useRef<Promise<boolean> | undefined>();

  const recognizer = useMemo(
    () => services.consentRecognizer ?? createBrowserConsentRecognizer(),
    [services.consentRecognizer],
  );

  const refreshVoices = useCallback(async () => {
    setVoices(await listOwnVoices(services.db));
  }, [services.db, setVoices]);

  useEffect(() => {
    void refreshVoices();
    void queryMicPermission().then(setMicState);
  }, [refreshVoices]);

  const ensureStream = useCallback(async () => {
    if (streamRef.current) return streamRef.current;
    const stream = await requestMicStream();
    streamRef.current = stream;
    setMicState('granted');
    return stream;
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = undefined;
  }, []);

  const startRecorder = useCallback(async () => {
    const stream = await ensureStream();
    if (services.testRecorder) {
      recorderRef.current = services.testRecorder as unknown as VoiceRecorder;
      await services.testRecorder.attach(stream);
      services.testRecorder.setLevelListener(setMicLevel);
      setRecording(true);
      return;
    }
    const VoiceRecorderCtor = await loadVoiceRecorder();
    const rec = new VoiceRecorderCtor({ maxDurationSec: 90 });
    rec.setLevelListener(setMicLevel);
    await rec.attach(stream);
    recorderRef.current = rec;
    setRecording(true);
  }, [ensureStream, services.testRecorder, setMicLevel]);

  const stopRecorder = useCallback(async () => {
    const rec = recorderRef.current;
    recorderRef.current = undefined;
    setRecording(false);
    setMicLevel(0);
    if (!rec) throw new Error('No active recording.');
    return rec.stop();
  }, [setMicLevel]);

  const beginRecordingFlow = () => {
    resetRecordingSession();
    setConsent(buildConsentPhrase());
    setStep('intro');
  };

  const onRequestMic = () => {
    setError(undefined);
    void ensureStream().catch(() => {
      setMicState('denied');
      setError('Microphone access was denied.');
    });
  };

  const onConsentRecordStart = () => {
    setError(undefined);
    consentMatchedRef.current = false;
    setConsentClip(undefined, false);
    if (!consent) return;
    consentAbort.current?.abort();
    consentAbort.current = new AbortController();
    void (async () => {
      try {
        await startRecorder();
        if (recognizer) {
          recognitionRef.current = recognizer.start(consent.text, consentAbort.current?.signal).then((result) => {
            if (result.matched) consentMatchedRef.current = true;
            return result.matched;
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not start recording.');
        setRecording(false);
      }
    })();
  };

  const onConsentRecordStop = () => {
    void (async () => {
      try {
        consentAbort.current?.abort();
        const clip = await stopRecorder();
        let matched = consentMatchedRef.current;
        if (!matched && recognitionRef.current) {
          matched = await recognitionRef.current.catch(() => false);
        }
        recognitionRef.current = undefined;
        if (matched) {
          setConsentClip(clip, true);
          return;
        }
        if (recognizer) {
          setError('Could not verify the phrase. Read every word clearly and try again.');
          setConsentClip(undefined, false);
          return;
        }
        setError('Speech verification is not available in this browser. Try Chrome or Edge on this device.');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Recording failed.');
      }
    })();
  };

  const currentPrompt = GUIDED_PROMPTS[promptIndex];

  const onPromptRecordStop = () => {
    void (async () => {
      try {
        const clip = await stopRecorder();
        if (!currentPrompt) return;
        savePromptClip(currentPrompt, clip);
        if (promptIndex + 1 >= GUIDED_PROMPTS.length) setStep('naming');
        else setPromptIndex(promptIndex + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Recording failed.');
      }
    })();
  };

  const onSaveVoice = () => {
    const state = useVoiceStudioStore.getState();
    const consentClip = state.consentClip;
    if (!state.consent || !consentClip || !state.consentVerified) {
      setError('Complete the consent step before saving.');
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        const samples = GUIDED_PROMPTS.map((p) => {
          const clip = state.promptClips[p.id];
          if (!clip) throw new Error('Missing prompt recording.');
          return { promptId: p.id, wav: clip.blob };
        });
        await saveOwnVoicePack(services.db, services.files, {
          name: state.draftName,
          language: state.language,
          consentPhrase: state.consent!.text,
          consentVerifiedAt: Date.now(),
          consentRecording: consentClip.blob,
          samples,
        });
        stopStream();
        resetRecordingSession();
        await refreshVoices();
        setStep('list');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save voice.');
      } finally {
        setBusy(false);
      }
    })();
  };

  const onExport = (voice: VoiceRecord) => {
    setBusy(true);
    void (async () => {
      try {
        const blob = await exportOwnVoiceZip(services.files, voice.id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${voice.name.replace(/\s+/g, '-').toLowerCase()}-voice-pack.zip`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Export failed.');
      } finally {
        setBusy(false);
      }
    })();
  };

  const onDelete = (voice: VoiceRecord) => {
    setBusy(true);
    void (async () => {
      try {
        await deleteOwnVoice(services.db, services.files, voice.id);
        await refreshVoices();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Delete failed.');
      } finally {
        setBusy(false);
      }
    })();
  };

  if (step === 'intro') {
    return (
      <IntroStep
        onBack={() => setStep('list')}
        onBegin={() => {
          setStep('consent');
          void queryMicPermission().then(setMicState);
        }}
      />
    );
  }

  if (step === 'consent' && consent) {
    return (
      <ConsentStep
        phrase={consent}
        micState={micState}
        recording={recording}
        level={micLevel}
        verified={consentVerified && !!consentClip}
        error={error}
        onRequestMic={onRequestMic}
        onStartRecord={onConsentRecordStart}
        onStopRecord={onConsentRecordStop}
        onContinue={() => setStep('recording')}
        onBack={() => setStep('intro')}
      />
    );
  }

  if (step === 'recording' && currentPrompt) {
    return (
      <RecordPromptStep
        prompt={currentPrompt}
        index={promptIndex}
        total={GUIDED_PROMPTS.length}
        recording={recording}
        level={micLevel}
        doneCount={Object.keys(promptClips).length}
        onStart={() => void startRecorder().catch((e) => setError(String(e)))}
        onStop={onPromptRecordStop}
        onBack={() => setStep('list')}
        onSkipBack={() => setPromptIndex(Math.max(0, promptIndex - 1))}
      />
    );
  }

  if (step === 'naming') {
    return (
      <>
        {error ? (
          <p className="pn-voice-studio__error" role="alert">
            {error}
          </p>
        ) : null}
        <NameVoiceStep
          name={draftName}
          onNameChange={setDraftName}
          onSave={onSaveVoice}
          onBack={() => setStep('recording')}
          saving={busy}
        />
      </>
    );
  }

  return (
    <MyVoicesPanel voices={voices} onRecordNew={beginRecordingFlow} onExport={onExport} onDelete={onDelete} busy={busy} />
  );
}

export default VoiceStudioApp;
