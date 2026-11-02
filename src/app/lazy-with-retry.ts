import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { importModule } from '@/app/chunk-import';

/** React.lazy that uses {@link importModule} so stale hashed chunks recover after a service worker update. */
export function lazyWithRetry<P extends Record<string, unknown>>(
  factory: () => Promise<{ default: ComponentType<P> }>,
): LazyExoticComponent<ComponentType<P>> {
  return lazy(() => importModule(factory));
}
