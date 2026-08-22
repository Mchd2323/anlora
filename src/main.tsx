import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary';
import {ToastProvider} from './components/ui/ToastProvider';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('#root elementi bulunamadı; index.html bozulmuş olabilir.');
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
