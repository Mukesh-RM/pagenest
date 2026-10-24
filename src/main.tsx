import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import '@/ui';
import { registerServiceWorker } from './sw';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html.');

registerServiceWorker();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
