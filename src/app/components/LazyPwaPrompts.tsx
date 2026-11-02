import { Suspense, useEffect, useState } from 'react';
import { lazyWithRetry } from '@/app/lazy-with-retry';
import { whenIdle } from '../idle';

const loadHost = () => import('./PwaPromptsHost').then((m) => ({ default: m.PwaPromptsHost }));
const PwaPromptsHost = lazyWithRetry(loadHost);

/**
 * The PWA prompts (update notice, install banner, iPhone steps) are overlays that are never part of
 * the first screen, so their code (bottom sheet, install steps, service worker hooks) is loaded
 * only when the browser is idle. Nothing renders in the page flow, so nothing can shift.
 */
export function LazyPwaPrompts() {
  const [ready, setReady] = useState(false);
  useEffect(() => whenIdle(() => setReady(true)), []);
  return ready ? (
    <Suspense fallback={null}>
      <PwaPromptsHost />
    </Suspense>
  ) : null;
}
