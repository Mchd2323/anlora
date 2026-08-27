import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary';
import {ToastProvider} from './components/ui/ToastProvider';
import {warmUpSpeech} from './utils/speech';
import './index.css';

/*
 * Ses listesini açılışta ısıt.
 *
 * `speechSynthesis.getVoices()` ilk çağrıda çoğu tarayıcıda boş döner ve
 * liste `voiceschanged` olayıyla sonradan dolar. Telaffuz düğmesine
 * basıldığında bu beklemeye girmek, tarayıcının KULLANICI DOKUNUŞU
 * bağlamını kaybettirir; mobilde ses yalnızca dokunuşun doğrudan devamında
 * başlatılabildiği için `speak()` sessizce hiçbir şey yapar. Yani motor
 * sağlamken bile ilk basış sessiz kalabilir.
 *
 * Burada bir kez çağrılınca liste uygulama açılırken hazırlanır; düğmeye
 * basıldığında bekleme kalmaz.
 */
warmUpSpeech();

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
