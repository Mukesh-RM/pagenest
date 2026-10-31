// Plain values for the audio player screens (kept out of the component files so fast refresh works).

/** The lengths the audio engine accepts for its skip buttons (`AudioOptions.skipBackSec` and `skipForwardSec`). */
export const SKIP_INTERVALS: readonly number[] = [10, 15, 30, 60];

/** Help-dialog texts that follow the skip lengths: `<ShortcutsProvider descriptions={playerShortcutDescriptions(15, 30)} />`. */
export function playerShortcutDescriptions(back: number, forward: number) {
  return {
    seekBack: `Back ${back} seconds`,
    seekForward: `Forward ${forward} seconds`,
    bookmark: 'Add a bookmark here',
  } as const;
}

