import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Anlora – Android paketleme yapılandırması.
 *
 * Uygulama, Vite çıktısını (`dist/`) cihaza gömer ve WebView'da yerel
 * dosyalardan açar. Oxford çekirdeği paketin içinde olduğu için sözlük,
 * kartlar ve ilerleme tamamen çevrimdışı çalışır.
 *
 * Sunucuya bağlı özellikler (hesap, bulut yedeği, Anlora AI) derleme
 * sırasında verilen `VITE_API_BASE_URL` adresine gider; bkz. src/config/api.ts.
 */
const config: CapacitorConfig = {
  appId: 'com.anlora.app',
  appName: 'Anlora',
  webDir: 'dist',
  android: {
    // Kullanıcının kendi kartlarını ve ilerlemesini localStorage tutuyor.
    // Bu bayrak, WebView'ın veriyi uygulama verisiyle birlikte saklamasını
    // ve yedeklemeye dahil etmesini sağlar.
    allowMixedContent: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#F8F7F3',
      showSpinner: false,
      androidSpinnerStyle: 'small'
    },
    StatusBar: {
      // Açık zeminli arayüz: durum çubuğu simgeleri koyu olmalı.
      style: 'LIGHT',
      backgroundColor: '#F8F7F3',
      /*
       * Durum çubuğu WebView'ın ÜSTÜNDE durur, üstüne binmez.
       *
       * Kaplama açıkken WebView ekranın en tepesinden başlıyor ve başlık
       * şeridinin üst yarısı saatin/pil simgesinin altında kalıyordu.
       * Kapalıyken sistem çubuğu kendi zeminini çizer, sayfa da altından
       * başlar. `.safe-top` sınıfı bu durumda sıfır boşluk döndürür, yani
       * iki çözüm birbirini katlamaz.
       */
      overlaysWebView: false
    }
  }
};

export default config;
