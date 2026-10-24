import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { attachProgressLifecycle } from '@/data/progress-service';
import { AppRoutes } from './routes';
import { ServicesProvider } from './services';
import { useServices, type AppServices } from './services-context';
import { ThemeProvider } from './ThemeProvider';

/** Saves any pending reading or listening position when the page is hidden or closed. */
function ProgressLifecycle() {
  const { progress } = useServices();
  useEffect(() => attachProgressLifecycle(progress, { visibility: document, page: window }), [progress]);
  return null;
}

/** Root component: services, theme, router. */
export function App({ services }: { services?: AppServices }) {
  return (
    <ServicesProvider {...(services ? { services } : {})}>
      <ProgressLifecycle />
      <ThemeProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ThemeProvider>
    </ServicesProvider>
  );
}
