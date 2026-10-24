import { Skeleton, SkeletonGroup } from '@/ui';

/**
 * Fallback for a tab while its chunk loads: the same header height and a skeleton block, so the
 * page does not jump when the real screen arrives (no layout shift).
 */
export function ScreenFallback() {
  return (
    <SkeletonGroup label="Loading">
      <div className="mb-4 flex min-h-touch items-center">
        <Skeleton variant="text" width="45%" height="1.75rem" />
      </div>
      <Skeleton variant="rect" height="9rem" className="w-full" />
    </SkeletonGroup>
  );
}

/** Fallback for onboarding: an empty themed page the same size as the real one. */
export function OnboardingFallback() {
  return <div className="min-h-full" aria-busy="true" />;
}
