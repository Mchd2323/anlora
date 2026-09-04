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
    /*
     * HTTPS sayfasında HTTP kaynak yüklenmez.
     *
     * Yedekleme kararı burada değil: bkz.
     * android/app/src/main/res/xml/data_extraction_rules.xml.
     */
    allowMixedContent: false,

    /*
     * Android 15 (targetSdk 35) kenardan kenara yerleşimi zorunlu kılıyor:
     * sistem çubukları artık pencerenin üstüne biniyor ve StatusBar
     * eklentisinin `overlaysWebView: false` ayarı orada etkisiz kalıyor.
     * Bu ayar olmadan başlık şeridi saatin/pil simgesinin, alt sekme çubuğu
     * da gezinme çubuğunun altında kalıyordu.
     *
     * 'auto': API 35 ve üstünde sistem çubuğu boşluklarını WebView'a kenar
     * boşluğu olarak uygular, eski sürümlerde hiçbir şey değiştirmez —
     * yani Android 14 ve altındaki bugünkü davranış aynen korunuyor.
     */
    adjustMarginsForEdgeToEdge: 'auto'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#F2E8D8',
      showSpinner: false,
      androidSpinnerStyle: 'small'
    },
    StatusBar: {
      // Açık zeminli arayüz: durum çubuğu simgeleri koyu olmalı.
      style: 'LIGHT',
      backgroundColor: '#F8F1E4',
      /*
       * Durum çubuğu WebView'ın ÜSTÜNDE durur, üstüne binmez.
       *
       * Kaplama açıkken WebView ekranın en tepesinden başlıyor ve başlık
       * şeridinin üst yarısı saatin/pil simgesinin altında kalıyordu.
       * Kapalıyken sistem çubuğu kendi zeminini çizer, sayfa da altından
       * başlar. `.safe-top` sınıfı bu durumda sıfır boşluk döndürür, yani
       * iki çözüm birbirini katlamaz.
       *
       * SINIRI: bu ayar Android 14 ve altında iş görür. Android 15'te
       * kenardan kenara yerleşim zorunlu olduğu için etkisizdir; oradaki
       * boşluğu yukarıdaki `adjustMarginsForEdgeToEdge` sağlıyor.
       */
      overlaysWebView: false
    }
  }
};

export default config;
