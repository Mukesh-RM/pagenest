import { BottomSheet } from '@/ui/components/BottomSheet';
import type { VoiceEngineId, VoiceInfo } from '@/engines/tts/types';

export interface NarrationSheetProps {
  readonly open: boolean;
  readonly voices: readonly VoiceInfo[];
  readonly selectedId: string;
  readonly onClose: () => void;
  readonly onPick: (voiceId: string, engine: VoiceEngineId) => void;
}

function VoiceRow({
  v,
  selectedId,
  onPick,
  onClose,
}: {
  readonly v: VoiceInfo;
  readonly selectedId: string;
  readonly onPick: NarrationSheetProps['onPick'];
  readonly onClose: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`pn-narration-voices__item${v.id === selectedId ? ' pn-narration-voices__item--active' : ''}`}
        onClick={() => {
          onPick(v.id, v.engine);
          onClose();
        }}
      >
        <span className="pn-narration-voices__name">{v.isOwnVoice ? 'My voice' : v.name}</span>
        <span className="pn-narration-voices__meta">
          {v.isOwnVoice
            ? v.name
            : v.installed
              ? 'On device'
              : v.sizeBytes
                ? `${Math.round(v.sizeBytes / 1_000_000)} MB download`
                : 'Download required'}
        </span>
      </button>
    </li>
  );
}

export function NarrationSheet({ open, voices, selectedId, onClose, onPick }: NarrationSheetProps) {
  const own = voices.filter((v) => v.isOwnVoice);
  const premade = voices.filter((v) => !v.isOwnVoice);

  return (
    <BottomSheet open={open} onClose={onClose} title="Read-aloud voice">
      {own.length > 0 ? (
        <>
          <p className="pn-narration-voices__section-label" id="pn-narration-my-voice">
            My voice
          </p>
          <ul className="pn-narration-voices" aria-labelledby="pn-narration-my-voice">
            {own.map((v) => (
              <VoiceRow key={v.id} v={v} selectedId={selectedId} onPick={onPick} onClose={onClose} />
            ))}
          </ul>
        </>
      ) : null}
      <p className="pn-narration-voices__section-label" id="pn-narration-premade">
        Premade voices
      </p>
      <ul className="pn-narration-voices" aria-labelledby="pn-narration-premade">
        {premade.map((v) => (
          <VoiceRow key={v.id} v={v} selectedId={selectedId} onPick={onPick} onClose={onClose} />
        ))}
      </ul>
    </BottomSheet>
  );
}
