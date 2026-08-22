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

// Servis çalışanını kaydet.
//
// Uygulamanın tüm verisi zaten tarayıcıda; eksik olan yalnızca uygulama
// kabuğunun çevrimdışı erişilebilir olmasıydı. Geliştirme sunucusunda
// kaydedilmez, aksi halde HMR ile çakışır.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Servis çalışanı kaydedilemedi:', error);
    });
  });
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
