import { useNavigate } from 'react-router-dom';
import { listenPath } from '@/app/route-paths';
import { MiniPlayer } from '@/ui';
import { useChromePlayerStore } from './chrome-store';
import { preloadPlayerEngine } from './lazy-runtime';

/**
 * Tab-bar mini-player shell: UI + chrome store only. The engine loads lazily on first control tap.
 */
export function ChromeMiniPlayer() {
  const chrome = useChromePlayerStore((s) => s.chrome);
  const navigate = useNavigate();

  if (!chrome.bookId) return null;

  const progress = chrome.durationSec > 0 ? chrome.positionSec / chrome.durationSec : 0;

  return (
    <MiniPlayer
      title={chrome.title}
      subtitle={chrome.subtitle}
      coverUrl={chrome.coverUrl}
      playing={chrome.playing}
      progress={progress}
      skipBackSeconds={chrome.skipBackSec}
      onTogglePlay={() => {
        preloadPlayerEngine();
        void import('./player-actions').then((m) => m.togglePlayback());
      }}
      onSkipBack={() => {
        preloadPlayerEngine();
        void import('./player-actions').then((m) => m.skipBack(chrome.skipBackSec));
      }}
      onExpand={() => {
        preloadPlayerEngine();
        navigate(listenPath(chrome.bookId!));
      }}
    />
  );
}
