/* eslint-disable @typescript-eslint/no-explicit-any -- mirrors React.lazy() which uses ComponentType<any> */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { importModule } from '@/app/chunk-import';

/** React.lazy that uses {@link importModule} so stale hashed chunks recover after a service worker update. */
export function lazyWithRetry<C extends ComponentType<any>>(
  factory: () => Promise<{ default: C }>,
): LazyExoticComponent<C> {
  return lazy(() => importModule(factory));
}
