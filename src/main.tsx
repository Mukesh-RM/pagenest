import { installWebKitFoliateIframeFix } from '@/engines/epub/foliate-webkit';
import { clearChunkReloadGuard } from '@/app/chunk-import';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

// Before any lazy engine chunk or service worker warms foliate-js (closed shadow iframes).
installWebKitFoliateIframeFix();
import { preloadCriticalFonts, preloadHeadingFonts } from '@/ui';
import { registerServiceWorker } from './sw';
import { whenIdle } from './app/idle';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html.');

// Inter first; Literata and the service worker after the shell can paint.
preloadCriticalFonts();

void import('./app/storage-bootstrap')
  .then(({ bootstrapStorage }) => bootstrapStorage())
  .then(() => {
    clearChunkReloadGuard();
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    whenIdle(() => preloadHeadingFonts(), 10_000);
    whenIdle(() => registerServiceWorker(), 10_000);
  });
