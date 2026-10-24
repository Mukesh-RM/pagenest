import { useNavigate } from 'react-router-dom';
import { useChromeStore } from '@/app/route-chrome';
import { listenPath } from '@/app/route-paths';
import { MiniPlayer } from '@/ui';
import { PlayerProvider } from './PlayerProvider';
import { useChromePlayerStore } from './chrome-store';
import { preloadPlayerEngine } from './lazy-runtime';

/**
 * Tab-bar mini-player shell: UI + chrome store. Mounts {@link PlayerProvider} in this lazy chunk.
 */
export function ChromeMiniPlayer(): null | JSX.Element {
  const session = useChromePlayerStore((s) => s.sessionActive);
  if (!session) return null;
  return (
    <div className="min-h-[calc(var(--pn-miniplayer-height)+var(--pn-space-2))]">
      <PlayerProvider>
        <ChromeMiniPlayerInner />
      </PlayerProvider>
    </div>
  );
}

useChromeStore.setState({ mp: ChromeMiniPlayer });

function ChromeMiniPlayerInner(): null | JSX.Element {
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
