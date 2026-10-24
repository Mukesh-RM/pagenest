import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { CoverUrlCache } from '@/data/cover-url';
import { createDataClient } from '@/data/data-client';
import { PageNestDB } from '@/data/db';
import { DexieProgressService } from '@/data/progress-service';
import { DEFAULT_CUSTOM_THEME } from '@/ui/theme/custom';
import { PlayerProvider } from '@/features/player';
import { AppRoutes } from './routes';
import { ServicesProvider } from './services';
import type { AppServices } from './services-context';
import { useSettings } from './settings-store';
import { ThemeProvider } from './ThemeProvider';

// The Library's windowed list lays rows out from the width of its container; jsdom reports 0, so a phone width is used.
Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 360 });

let counter = 0;

/** A fresh, isolated database and services for one test. Close `services.db` afterwards. */
export function makeServices(prefix = 'pagenest-test'): AppServices {
  counter += 1;
  const db = new PageNestDB(`${prefix}-${counter}`);
  const data = createDataClient({ db, workerFactory: () => undefined });
  return { db, progress: new DexieProgressService(db), data, covers: new CoverUrlCache({ load: (id) => data.books.getCover(id) }) };
}

/** Put the settings store back to its first-run defaults. */
export function resetSettings(): void {
  useSettings.setState({ loaded: false, themePreference: 'system', customTheme: { ...DEFAULT_CUSTOM_THEME }, contrastMode: 'system', fontSizePx: 16, onboardingDone: false });
}

/**
 * Render the whole app (services, theme, router) at `path`.
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
            <PlayerProvider>
              <AppRoutes />
            </PlayerProvider>
          </Router>
        </ThemeProvider>
      </ServicesProvider>,
    ),
  );
}
