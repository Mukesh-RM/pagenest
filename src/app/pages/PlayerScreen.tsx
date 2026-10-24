import type { ComponentProps } from 'react';
import '../screen-styles';
import AudiobookPlayerScreen from '@/features/player/AudiobookPlayerScreen';
import { PlayerProvider } from '@/features/player/PlayerProvider';

export default function PlayerScreen(props: ComponentProps<typeof AudiobookPlayerScreen>): JSX.Element {
  return (
    <PlayerProvider>
      <AudiobookPlayerScreen {...props} />
    </PlayerProvider>
  );
}
