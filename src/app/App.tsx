import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { attachProgressLifecycle } from '@/data/progress-service';
import { AppRoutes } from './routes';
import { ServicesProvider } from './services';
import { useServices, type AppServices } from './services-context';
import { scheduleStartupCleanup } from './startup';
import { flushSettings } from './settings-store';
import { ThemeProvider } from './ThemeProvider';
import { LazyPlayerRoot } from '@/features/player/LazyPlayerRoot';

/** Saves pending reading or listening position and settings when the page is hidden or closed. */
function ProgressLifecycle() {
  const { progress, data } = useServices();
  // Once per start, when idle: remove files left by an interrupted import (see ./startup.ts).
  useEffect(() => {
    void scheduleStartupCleanup(data);
  }, [data]);
  useEffect(() => attachProgressLifecycle(progress, { visibility: document, page: window }), [progress]);
  useEffect(() => {
    const flush = (): void => {
      if (document.visibilityState !== 'visible') void flushSettings();
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, []);
  return null;
}

/** Root component: services, theme, router. */
export function App({ services }: { services?: AppServices }) {
  return (
    <ServicesProvider {...(services ? { services } : {})}>
      <ProgressLifecycle />
      <ThemeProvider>
        <BrowserRouter>
          <LazyPlayerRoot>
            <AppRoutes />
          </LazyPlayerRoot>
        </BrowserRouter>
      </ThemeProvider>
    </ServicesProvider>
  );
}
