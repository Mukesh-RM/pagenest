import { MiniPlayerHost } from './MiniPlayerHost';
import { FullPlayerSheet } from './FullPlayerSheet';
import { useAudioController } from './PlayerProvider';

/** Mini-player and full-player sheet. Must render inside a React Router. */
export function PlayerChrome() {
  const controller = useAudioController();
  return (
    <>
      <MiniPlayerHost controller={controller} />
      <FullPlayerSheet controller={controller} />
    </>
  );
}
