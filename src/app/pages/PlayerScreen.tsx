import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import '../screen-styles';
import AudiobookPlayerScreen from '@/features/player/AudiobookPlayerScreen';

type ProviderComponent = (props: { children: ReactNode }) => JSX.Element;

export default function PlayerScreen(props: ComponentProps<typeof AudiobookPlayerScreen>): JSX.Element {
  const [Provider, setProvider] = useState<ProviderComponent | null>(null);

  useEffect(() => {
    void import('@/features/player/PlayerProvider').then((m) => setProvider(() => m.PlayerProvider));
  }, []);

  if (!Provider) {
    return <p className="px-[var(--pn-margin)] pt-[calc(1rem+var(--pn-safe-top))] text-muted">Loading player…</p>;
  }

  return (
    <Provider>
      <AudiobookPlayerScreen {...props} />
    </Provider>
  );
}
