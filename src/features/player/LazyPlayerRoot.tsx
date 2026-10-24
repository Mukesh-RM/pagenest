import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useChromePlayerStore } from './chrome-store';
import { preloadPlayerEngine } from './lazy-runtime';

/**
 * Mounts {@link PlayerProvider} only on `/listen/:id` or while a chrome session is active.
 */
export function LazyPlayerRoot({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const sessionActive = useChromePlayerStore((s) => s.sessionActive);
  const onListen = pathname.startsWith('/listen/');
  const needEngine = onListen || sessionActive;

  const [Provider, setProvider] = useState<ComponentType<{ children: ReactNode }> | null>(null);

  useEffect(() => {
    if (!needEngine) {
      setProvider(null);
      return;
    }
    preloadPlayerEngine();
    void import('./PlayerProvider').then((m) => setProvider(() => m.PlayerProvider));
  }, [needEngine]);

  if (!needEngine || !Provider) return children;
  return <Provider>{children}</Provider>;
}
