import { Button } from '@/ui/components/Button';
import type { ConsentPhrase } from '../consent/phrases';

export interface ConsentStepProps {
  phrase: ConsentPhrase;
  micState: 'unknown' | 'prompt' | 'granted' | 'denied';
  recording: boolean;
  level: number;
  verified: boolean;
  error?: string;
  onRequestMic: () => void;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onContinue: () => void;
  onBack: () => void;
}

export function ConsentStep({
  phrase,
  micState,
  recording,
  level,
  verified,
  error,
  onRequestMic,
  onStartRecord,
  onStopRecord,
  onContinue,
  onBack,
}: ConsentStepProps) {
  const micBlocked = micState === 'denied';
  return (
    <div className="pn-voice-studio pn-voice-studio--step">
      <header className="pn-voice-studio__step-header">
        <Button iconOnly variant="ghost" icon="arrowLeft" aria-label="Back" onClick={onBack} />
        <p className="pn-voice__step" aria-label="Step 2 of 4">
          Step 2 of 4 · Consent
        </p>
      </header>
      <h1 className="pn-screen__title">Confirm it is your voice</h1>
      <p className="pn-voice__intro">
        This voice will be you. Only record your own voice. Read the phrase below aloud in one go so PageNest knows you are
        present.
      </p>

      <p className="pn-voice-studio__phrase" aria-live="polite">
        {phrase.text}
      </p>

      {micBlocked ? (
        <div className="pn-voice-studio__callout" role="alert">
          Microphone access is blocked. Open your browser site settings for PageNest and allow the microphone, then try again.
        </div>
      ) : null}

      {micState === 'prompt' || micState === 'unknown' ? (
        <Button block onClick={onRequestMic}>
          Allow microphone
        </Button>
      ) : null}

      {micState === 'granted' ? (
        <>
          <div className="pn-voice-studio__meter" aria-hidden="true">
            <div className="pn-voice-studio__meter-fill" style={{ transform: `scaleX(${Math.max(0.05, level)})` }} />
          </div>
          <Button block variant={recording ? 'danger-solid' : 'primary'} onClick={recording ? onStopRecord : onStartRecord}>
            {recording ? 'Stop and verify' : 'Start reading the phrase'}
          </Button>
        </>
      ) : null}

      {verified ? (
        <p className="pn-voice-studio__success" role="status">
          Phrase verified. You can continue to the guided prompts.
        </p>
      ) : null}

      {error ? (
        <p className="pn-voice-studio__error" role="alert">
          {error}
        </p>
      ) : null}

      <footer className="pn-voice-studio__footer">
        <Button block onClick={onContinue} disabled={!verified}>
          Continue
        </Button>
      </footer>
    </div>
  );
}
