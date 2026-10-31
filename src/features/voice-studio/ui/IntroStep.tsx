import { Button } from '@/ui/components/Button';

export interface IntroStepProps {
  onBegin: () => void;
  onBack: () => void;
}

export function IntroStep({ onBegin, onBack }: IntroStepProps) {
  return (
    <div className="pn-voice-studio pn-voice-studio--step">
      <header className="pn-voice-studio__step-header">
        <Button iconOnly variant="ghost" icon="arrowLeft" aria-label="Back" onClick={onBack} />
        <p className="pn-voice__step" aria-label="Step 1 of 4">
          Step 1 of 4 · Before you start
        </p>
      </header>
      <h1 className="pn-screen__title">Your voice stays here</h1>
      <ul className="pn-voice-studio__checklist">
        <li>Use a quiet room and hold the device about a hand-width away.</li>
        <li>Only record yourself. A random phrase proves you are speaking live.</li>
        <li>Samples are stored in this browser only. Export is optional and meant for your own training.</li>
      </ul>
      <footer className="pn-voice-studio__footer">
        <Button block onClick={onBegin}>
          I am ready
        </Button>
      </footer>
    </div>
  );
}
