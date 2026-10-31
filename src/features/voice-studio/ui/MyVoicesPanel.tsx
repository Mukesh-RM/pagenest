import './voice-studio.css';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/icons';
import type { VoiceRecord } from '@/data/schema';

export interface MyVoicesPanelProps {
  voices: readonly VoiceRecord[];
  onRecordNew: () => void;
  onExport: (voice: VoiceRecord) => void;
  onDelete: (voice: VoiceRecord) => void;
  busy?: boolean;
}

export function MyVoicesPanel({ voices, onRecordNew, onExport, onDelete, busy }: MyVoicesPanelProps) {
  return (
    <div className="pn-voice-studio">
      <header className="pn-voice-studio__hero">
        <Icon name="mic" size={28} />
        <div>
          <h1 className="pn-screen__title">Voice Studio</h1>
          <p className="pn-voice-studio__lede">
            Record your own voice for narration. Samples stay on this device; only you can export or delete them.
          </p>
        </div>
      </header>

      <section aria-labelledby="vs-my-voices-heading">
        <h2 id="vs-my-voices-heading" className="pn-voice-studio__section-title">
          My voices
        </h2>
        {voices.length === 0 ? (
          <p className="pn-voice-studio__empty">No personal voices yet. Start a guided recording when you are in a quiet room.</p>
        ) : (
          <ul className="pn-voice-studio__voice-list">
            {voices.map((v) => (
              <li key={v.id} className="pn-voice-studio__voice-row">
                <div className="pn-voice-studio__voice-meta">
                  <span className="pn-voice-studio__voice-name">{v.name}</span>
                  <span className="pn-voice-studio__voice-sub">
                    {v.language.toUpperCase()} · Own voice · Stored offline
                  </span>
                </div>
                <div className="pn-voice-studio__voice-actions">
                  <Button variant="secondary" onClick={() => onExport(v)} disabled={busy}>
                    Export pack
                  </Button>
                  <Button variant="danger" onClick={() => onDelete(v)} disabled={busy}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="pn-voice-studio__footer">
        <Button block icon="mic" onClick={onRecordNew} disabled={busy}>
          Record my voice
        </Button>
        <p className="pn-voice-studio__fine-print">
          You must read a live consent phrase before any recording is saved. Pre-recorded clips of other people cannot be used.
        </p>
      </footer>
    </div>
  );
}
