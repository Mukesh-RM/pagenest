import type { PageNestDB } from '@/data/db';

/**
 * Inserts the review seed audiobook when `?pn_seed_audio=1` is present. Only compiled when
 * `import.meta.env.DEV` or `VITE_PN_SEED_AUDIO=1` (see `seed-build.ts`).
 */
export async function maybeEnsureSeedAudiobookOnRoute(db: PageNestDB, bookId: string): Promise<boolean> {
  if (!import.meta.env.DEV && import.meta.env.VITE_PN_SEED_AUDIO !== '1') return false;
  const seed = await import('@/features/player/seed/seed-audiobook');
  if (bookId !== seed.SEED_AUDIO_BOOK_ID || !seed.isSeedAudiobookRequest()) return false;
  await seed.ensureSeedAudiobookBookRecord(db);
  return true;
}
