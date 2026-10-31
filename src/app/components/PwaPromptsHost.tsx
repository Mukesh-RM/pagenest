import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PwaPrompts } from '@/ui';
import { localHintStore } from '../hint-store';
import { useChromeStore } from '../route-chrome';
import { useServices } from '../services-context';

/**
 * The three PWA prompts (update notice, Android install banner, iPhone steps), wired to the app:
 * the install offer waits until the library has its first book, and each offer shows once (remembered
 * on the device). While the audio owner's mini-player is active (it reports a loaded session, which is the safe
 * reading of "playing" until the audio controller exposes a real flag), the update
 * notice has no Refresh button, so an update can never cut playback.
 */
export function PwaPromptsHost() {
  const { pathname } = useLocation();
  const { db } = useServices();
  const [store] = useState(() => localHintStore());
  const hasBook = useLiveQuery(async () => (await db.books.count()) > 0, [db]);
  const playing = useChromeStore((s) => s.as);
  const immersive = pathname.startsWith('/listen/') || pathname.startsWith('/read/');
  return (
    <PwaPrompts
      isPlaying={playing}
      installOfferReady={hasBook === true && !immersive}
      store={store}
    />
  );
}
