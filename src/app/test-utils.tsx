import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { PageNestDB } from '@/data/db';
import { DexieProgressService } from '@/data/progress-service';
import { BackStackProvider } from './back';
import { AppRoutes } from './routes';
import { ServicesProvider } from './services';
import type { AppServices } from './services-context';
import { useSettings } from './settings-store';
import { ThemeProvider } from './ThemeProvider';

let counter = 0;

/** A fresh, isolated database and services for one test. Close `services.db` afterwards. */
export function makeServices(prefix = 'pagenest-test'): AppServices {
  counter += 1;
  const db = new PageNestDB(`${prefix}-${counter}`);
  return { db, progress: new DexieProgressService(db) };
}

/** Put the settings store back to its first-run defaults. */
export function resetSettings(): void {
  useSettings.setState({ loaded: false, themePreference: 'system', fontSizePx: 16, onboardingDone: false });
}

/**
 * Render the whole app (services, theme, router, back stack) at `path`.
 * Uses `BrowserRouter` when `browserHistory` is true, so the real
 * `window.history` (and the back gesture) can be exercised.
 */
export function renderApp(
  services: AppServices,
  options: { path?: string; browserHistory?: boolean; wrap?: (children: ReactElement) => ReactElement } = {},
): RenderResult {
  const { path = '/', browserHistory = false, wrap = (c) => c } = options;
  const Router = browserHistory ? BrowserRouter : MemoryRouter;
  const routerProps = browserHistory ? {} : { initialEntries: [path] };
  return render(
    wrap(
      <ServicesProvider services={services}>
        <ThemeProvider>
          <Router {...routerProps}>
            <BackStackProvider>
              <AppRoutes />
            </BackStackProvider>
          </Router>
        </ThemeProvider>
      </ServicesProvider>,
    ),
  );
}
