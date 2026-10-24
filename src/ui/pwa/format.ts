/** "12 MB", "4.2 GB": short sizes for storage text. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 MB';
  const units: readonly [string, number][] = [
    ['GB', 1024 ** 3],
    ['MB', 1024 ** 2],
    ['KB', 1024],
  ];
  for (const [unit, size] of units) {
    if (bytes >= size) {
      const value = bytes / size;
      return `${value >= 10 || Number.isInteger(value) ? Math.round(value) : value.toFixed(1)} ${unit}`;
    }
  }
  return `${Math.round(bytes)} B`;
}
