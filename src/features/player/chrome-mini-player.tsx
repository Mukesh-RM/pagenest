import { useNavigate } from 'react-router-dom';
import { registerMiniPlayerComponent } from '@/app/audio-mini-register';
import { listenPath } from '@/app/route-paths';
import { MiniPlayer } from '@/ui';
import { PlayerProvider } from './PlayerProvider';
import { useChromePlayerStore } from './chrome-store';
import { preloadPlayerEngine } from './lazy-runtime';

/**
 * Tab-bar mini-player shell: UI + chrome store. Mounts {@link PlayerProvider} in this lazy chunk.
 */
export function ChromeMiniPlayer(): JSX.Element {
  return (
    <div className="min-h-[calc(var(--pn-miniplayer-height)+var(--pn-space-2))]">
      <PlayerProvider>
        <ChromeMiniPlayerInner />
      </PlayerProvider>
    </div>
  );
}

registerMiniPlayerComponent(ChromeMiniPlayer);

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
