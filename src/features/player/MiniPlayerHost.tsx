import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MiniPlayer } from '@/ui';
import type { AudioController } from '@/engines/audio/types';
import { chapterSubtitle } from '@/engines/audio/media-session';
import { usePlayerStore } from './audio-store';

export function MiniPlayerHost({ controller }: { controller: AudioController }) {
  const state = usePlayerStore((s) => s.state);
  const setFullPlayerOpen = usePlayerStore((s) => s.setFullPlayerOpen);
  const navigate = useNavigate();

  const coverUrl = useMemo(() => {
    const cover = state.item?.cover;
    if (!cover) return undefined;
    return URL.createObjectURL(cover);
  }, [state.item?.cover]);

  if (!state.item || state.status === 'idle') return null;

  const progress =
    state.durationSec > 0 ? state.positionSec / state.durationSec : 0;

  return (
    <MiniPlayer
      title={state.item.title}
      subtitle={chapterSubtitle(state)}
      coverUrl={coverUrl}
      playing={state.status === 'playing'}
      progress={progress}
      skipBackSeconds={state.options.skipBackSec}
      onTogglePlay={() => void controller.toggle()}
      onSkipBack={() => controller.skip(-state.options.skipBackSec)}
      onExpand={() => {
        setFullPlayerOpen(true);
        if (state.item) navigate(`/listen/${state.item.bookId}`);
      }}
    />
  );
}
