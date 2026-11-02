import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { importModule } from '@/app/chunk-import';

/** React.lazy that uses {@link importModule} so stale hashed chunks recover after a service worker update. */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() => importModule(factory));
}
