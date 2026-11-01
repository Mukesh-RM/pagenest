import { BottomSheet } from '@/ui/components/BottomSheet';
import type { VoiceEngineId, VoiceInfo } from '@/engines/tts/types';

export interface NarrationSheetProps {
  readonly open: boolean;
  readonly voices: readonly VoiceInfo[];
  readonly selectedId: string;
  readonly onClose: () => void;
  readonly onPick: (voiceId: string, engine: VoiceEngineId) => void;
}

function voiceMeta(v: VoiceInfo): string {
  if (v.isOwnVoice) return v.name;
  if (v.engine === 'speech') return 'Built-in on this device';
  if (v.engine === 'piper') {
    return v.installed ? 'Downloaded · HD' : v.sizeBytes ? `${Math.round(v.sizeBytes / 1_000_000)} MB · one-time download` : 'One-time download';
  }
  return v.installed ? 'On device' : 'Download required';
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
        <span className="pn-narration-voices__meta">{voiceMeta(v)}</span>
      </button>
    </li>
  );
}

export function NarrationSheet({ open, voices, selectedId, onClose, onPick }: NarrationSheetProps) {
  const device = voices.filter((v) => v.engine === 'speech');
  const own = voices.filter((v) => v.isOwnVoice);
  const hd = voices.filter((v) => v.engine === 'piper');

  return (
    <BottomSheet open={open} onClose={onClose} title="Read-aloud voice">
      {device.length > 0 ? (
        <>
          <p className="pn-narration-voices__section-label" id="pn-narration-device">
            This device
          </p>
          <ul className="pn-narration-voices" aria-labelledby="pn-narration-device">
            {device.map((v) => (
              <VoiceRow key={v.id} v={v} selectedId={selectedId} onPick={onPick} onClose={onClose} />
            ))}
          </ul>
        </>
      ) : null}
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
      {hd.length > 0 ? (
        <>
          <p className="pn-narration-voices__section-label" id="pn-narration-hd">
            HD voices (one-time download)
          </p>
          <ul className="pn-narration-voices" aria-labelledby="pn-narration-hd">
            {hd.map((v) => (
              <VoiceRow key={v.id} v={v} selectedId={selectedId} onPick={onPick} onClose={onClose} />
            ))}
          </ul>
        </>
      ) : null}
    </BottomSheet>
  );
}
