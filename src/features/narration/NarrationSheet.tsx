import { BottomSheet } from '@/ui/components/BottomSheet';
import type { VoiceInfo } from '@/engines/tts/types';

export interface NarrationSheetProps {
  readonly open: boolean;
  readonly voices: readonly VoiceInfo[];
  readonly selectedId: string;
  readonly onClose: () => void;
  readonly onPick: (voiceId: string) => void;
}

export function NarrationSheet({ open, voices, selectedId, onClose, onPick }: NarrationSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Read-aloud voice">
      <ul className="pn-narration-voices">
        {voices.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              className={`pn-narration-voices__item${v.id === selectedId ? ' pn-narration-voices__item--active' : ''}`}
              onClick={() => {
                onPick(v.id);
                onClose();
              }}
            >
              <span className="pn-narration-voices__name">{v.name}</span>
              <span className="pn-narration-voices__meta">
                {v.installed ? 'On device' : v.sizeBytes ? `${Math.round(v.sizeBytes / 1_000_000)} MB download` : 'Download required'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
