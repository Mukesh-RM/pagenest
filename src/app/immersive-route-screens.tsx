import { lazy } from 'react';

export const ReadScreen = lazy(() => import('./pages/ReadRoute').then((m) => ({ default: m.ReadRoute })));
export const ListenScreen = lazy(() => import('./pages/ListenRoute').then((m) => ({ default: m.ListenRoute })));
