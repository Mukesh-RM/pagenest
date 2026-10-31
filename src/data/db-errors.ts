/** True when Dexie (or IndexedDB) was closed while an operation was still in flight. */
export function isDatabaseClosedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: string }).name;
  if (name === 'DatabaseClosedError') return true;
  const inner = (error as { inner?: { name?: string } }).inner;
  return inner?.name === 'DatabaseClosedError';
}
