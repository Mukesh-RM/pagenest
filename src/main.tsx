import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { preloadCriticalFonts } from '@/ui';
import { registerServiceWorker } from './sw';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html.');

// Start fetching Inter and Literata (regular) before the first render, so headings and book
// titles appear in the right typeface without a swap.
preloadCriticalFonts();

registerServiceWorker();

void import('./app/storage-bootstrap')
  .then(({ bootstrapStorage }) => bootstrapStorage())
  .then(() => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
