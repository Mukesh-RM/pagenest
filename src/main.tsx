import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
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
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    whenIdle(() => preloadHeadingFonts(), 10_000);
    whenIdle(() => registerServiceWorker(), 10_000);
  });
