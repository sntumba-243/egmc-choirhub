import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { registerServiceWorker, startVersionPolling } from './serviceWorkerUtils';
import { initSentry } from './lib/sentry';
import { patchDomForExternalMutations } from './lib/domPatch';
import './index.css';

// Must run before React mounts — see lib/domPatch.ts (Google Translate crash).
patchDomForExternalMutations();
initSentry();
registerServiceWorker();
startVersionPolling();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
