import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { PwaPrompts } from '@/ui';
import { useIsPlaying } from '@/features/player';
import { localHintStore } from '../hint-store';
import { useServices } from '../services-context';

/**
 * The three PWA prompts (update notice, Android install banner, iPhone steps), wired to the app:
 * the install offer waits until the library has its first book, and each offer shows once (remembered
 * on the device). While the audio owner's mini-player is active (it reports a loaded session, which is the safe
 * reading of "playing" until the audio controller exposes a real flag), the update
 * notice has no Refresh button, so an update can never cut playback.
 */
export function PwaPromptsHost() {
  const { db } = useServices();
  const [store] = useState(() => localHintStore());
  const hasBook = useLiveQuery(async () => (await db.books.count()) > 0, [db]);
  const playing = useIsPlaying();
  return <PwaPrompts isPlaying={playing} installOfferReady={hasBook === true} store={store} />;
}
