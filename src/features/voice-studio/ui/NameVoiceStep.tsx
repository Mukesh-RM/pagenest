import { Button } from '@/ui/components/Button';

export interface NameVoiceStepProps {
  name: string;
  onNameChange: (value: string) => void;
  onSave: () => void;
  onBack: () => void;
  saving: boolean;
}

export function NameVoiceStep({ name, onNameChange, onSave, onBack, saving }: NameVoiceStepProps) {
  return (
    <div className="pn-voice-studio pn-voice-studio--step">
      <header className="pn-voice-studio__step-header">
        <Button iconOnly variant="ghost" icon="arrowLeft" aria-label="Back" onClick={onBack} />
        <p className="pn-voice__step" aria-label="Step 4 of 4">
          Step 4 of 4 · Save
        </p>
      </header>
      <h1 className="pn-screen__title">Name your voice</h1>
      <p className="pn-voice__intro">Pick a name you will recognize in narration settings. You can export or delete this voice any time.</p>
      <label className="pn-voice-studio__field">
        <span className="pn-voice-studio__field-label">Voice name</span>
        <input
          className="pn-voice-studio__input"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={64}
          autoComplete="off"
        />
      </label>
      <footer className="pn-voice-studio__footer">
        <Button block onClick={onSave} disabled={!name.trim() || saving}>
          {saving ? 'Saving…' : 'Save to this device'}
        </Button>
      </footer>
    </div>
  );
}
