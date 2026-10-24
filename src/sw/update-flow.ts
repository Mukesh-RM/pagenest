/** What the update notice should show (blueprint 14: quiet, never interrupts a playing book). */
export type UpdateUi =
  | { kind: 'none' }
  /** Show "New version ready, refresh" with a Refresh button. */
  | { kind: 'refresh' }
  /** Audio is playing: show "applies next time you open PageNest" with no button. */
  | { kind: 'next-launch' };

export interface UpdateState {
  /** A new version finished installing and is waiting. */
  needRefresh: boolean;
  /** Audio or read-aloud is playing right now. */
  isPlaying: boolean;
  /** The user closed the notice for this version. */
  dismissed?: boolean;
}

/** Playback always wins: reloading the page would stop the audio element. */
export function updateUi({ needRefresh, isPlaying, dismissed = false }: UpdateState): UpdateUi {
  if (!needRefresh || dismissed) return { kind: 'none' };
  return isPlaying ? { kind: 'next-launch' } : { kind: 'refresh' };
}

export const UPDATE_CHECK_GAP_MS = 6 * 60 * 60 * 1000;

/** Look for a new version when the app returns to the foreground, at most every six hours. */
export function shouldCheckForUpdate(nowMs: number, lastCheckMs: number, minGapMs = UPDATE_CHECK_GAP_MS): boolean {
  return nowMs - lastCheckMs >= minGapMs;
}
