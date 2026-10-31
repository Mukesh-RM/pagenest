/** True when the review seed audiobook is compiled in (dev server or `VITE_PN_SEED_AUDIO=1` build). */
export function isSeedAudioBuildEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_PN_SEED_AUDIO === '1';
}
