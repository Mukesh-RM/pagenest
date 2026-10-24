import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { listenPath } from '@/app/route-paths';
import { MiniPlayer } from '@/ui';
import { chapterSubtitle } from '@/engines/audio/media-session';
import { useAudioController } from './PlayerProvider';
import { usePlayerStore } from './audio-store';

/**
 * Tab-bar mini-player (visual only). Playback state lives in {@link useAudioController}, not here.
 */
export function AudioMiniPlayer() {
  const controller = useAudioController();
  const state = usePlayerStore((s) => s.state);
  const navigate = useNavigate();

  const coverUrl = useMemo(() => {
    const cover = state.item?.cover;
    if (!cover) return undefined;
    return URL.createObjectURL(cover);
  }, [state.item?.cover]);

  if (!state.item || state.status === 'idle') return null;

  const progress = state.durationSec > 0 ? state.positionSec / state.durationSec : 0;

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
      onExpand={() => navigate(listenPath(state.item!.bookId))}
    />
  );
}
