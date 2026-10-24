/** Skeleton cards instead of spinners while data loads (blueprint 5.8). */
export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="aspect-[2/3] animate-pulse rounded-card bg-surface" />
      ))}
    </ul>
  );
}
