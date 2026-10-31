import { Button } from '@/ui/components/Button';
import type { GuidedPrompt } from '../prompts/guided-prompts';

export interface RecordPromptStepProps {
  prompt: GuidedPrompt;
  index: number;
  total: number;
  recording: boolean;
  level: number;
  doneCount: number;
  onStart: () => void;
  onStop: () => void;
  onBack: () => void;
  onSkipBack: () => void;
}

export function RecordPromptStep({
  prompt,
  index,
  total,
  recording,
  level,
  doneCount,
  onStart,
  onStop,
  onBack,
  onSkipBack,
}: RecordPromptStepProps) {
  return (
    <div className="pn-voice-studio pn-voice-studio--step">
      <header className="pn-voice-studio__step-header">
        <Button iconOnly variant="ghost" icon="arrowLeft" aria-label="Back" onClick={onBack} />
        <p className="pn-voice__step" aria-label={`Step 3 of 4, prompt ${index + 1} of ${total}`}>
          Step 3 of 4 · Prompt {index + 1} of {total}
        </p>
      </header>
      <h1 className="pn-screen__title">{prompt.title}</h1>
      <p className="pn-voice-studio__prompt-text">{prompt.text}</p>
      <p className="pn-voice-studio__progress" aria-live="polite">
        {doneCount} of {total} prompts recorded
      </p>
      <div className="pn-voice-studio__meter" aria-hidden="true">
        <div className="pn-voice-studio__meter-fill" style={{ transform: `scaleX(${Math.max(0.05, level)})` }} />
      </div>
      <Button block variant={recording ? 'danger-solid' : 'primary'} onClick={recording ? onStop : onStart}>
        {recording ? 'Stop recording' : 'Record this line'}
      </Button>
      {index > 0 ? (
        <Button variant="ghost" block onClick={onSkipBack}>
          Previous prompt
        </Button>
      ) : null}
    </div>
  );
}
