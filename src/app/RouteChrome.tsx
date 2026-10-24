import type { ReactNode } from 'react';
import type { RouteChrome as Chrome } from '@/app/contracts';
import { useChromeRegistration } from './route-chrome';

/**
 * Sets the default chrome for a route in the route table:
 * `<Route path="..." element={<RouteChrome chrome="immersive">...</RouteChrome>} />`.
 * Put it outside `Suspense`, so the frame is already right while the screen's code loads.
 * A screen can still override it with `useRouteChrome`.
 */
export function RouteChrome({ chrome, children }: { chrome: Chrome; children: ReactNode }) {
  useChromeRegistration(chrome, 'route');
  return <>{children}</>;
}
