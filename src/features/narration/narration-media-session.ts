/** Minimal read-aloud metadata for lock-screen / notification controls (blueprint Phase 4). */
export function syncNarrationMediaSession(payload: {
  title: string;
  author?: string;
  playing: boolean;
}): void {
  const session = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
  if (!session) return;
  if (!payload.playing) {
    session.playbackState = 'none';
    return;
  }
  session.metadata = new MediaMetadata({
    title: payload.title,
    artist: payload.author ?? 'Read aloud',
    album: payload.title,
  });
  session.playbackState = 'playing';
}

export function clearNarrationMediaSession(): void {
  const session = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
  if (!session) return;
  session.playbackState = 'none';
}
