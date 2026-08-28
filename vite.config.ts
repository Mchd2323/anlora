import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  /*
   * Derleme damgası.
   *
   * Telefondaki uygulamanın HANGİ derleme olduğunu ekranda görebilmek için.
   * Buna ihtiyaç duyulmasının sebebi somut: ses tanısı iki farklı APK'de
   * birbirinin aynı çıktıyı verdi, oysa aradaki kod değişikliği o çıktıyı
   * üretemezdi. Yani yeni paket cihaza ulaşmamıştı ve bunu anlamanın hiçbir
   * yolu yoktu — hata ayıklamanın önündeki asıl engel buydu.
   *
   * CI her derlemede ANLORA_VERSION_NAME veriyor; yerelde 'dev' kalır.
   */
  const derlemeAdi = (process.env.ANLORA_VERSION_NAME || '').trim() || 'dev';

  return {
    define: {
      __ANLORA_BUILD__: JSON.stringify(derlemeAdi),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Oxford sözlüğü yaklaşık 5 MB'lık JSON'dur ve uygulama kodundan çok
          // daha seyrek değişir. Ayrı bir parçaya alınınca kullanıcı sözlüğü
          // bir kez indirir ve sonraki dağıtımlarda önbellekten kullanır;
          // yalnızca uygulama parçası yeniden iner.
          //
          // Kalıp önceden 'src/data/words' idi; dosya `oxford3000.json` adını
          // aldığında eşleşmeyi kaybetmiş ve 3 MB'lık liste sessizce ana
          // uygulama parçasına geri düşmüştü.
          //
          // NOT: Bu yalnızca önbelleklemeyi iyileştirir, ilk yükleme boyutunu
          // değil; Oxford verisi hâlâ açılışta baştan sona yükleniyor. Genel
          // Dağarcık katmanı (`src/data/extended/band-*.json`) ise burada yer
          // ALMAZ: o dosyalara yalnızca dinamik `import()` ile ulaşılır, bu
          // yüzden Rollup her bandı kendi tembel parçasına ayırır.
          manualChunks(id: string) {
            if (id.includes('src/data/oxford3000') || id.includes('src/data/oxford5000')) {
              return 'oxford-data';
            }
            /*
             * Genişletilmiş sözlüğün DİZİNİ (madde başları, ~52 KB). Harf
             * dosyalarından ayrı tutuluyor çünkü ikisi farklı zamanlarda
             * gerekiyor: dizin, kelime eklerken "bu kelime bizde var mı"
             * sorusunu yanıtlar ve çevrimdışı da gerekir; harf dosyaları
             * yalnızca kullanıcı o kelimeyi seçtiğinde iner.
             *
             * Adının ayırt edilebilir olması şart: servis çalışanı
             * ön-önbellek listesini dosya adına bakarak kuruyor ve bu parça
             * önceden 'index-<özet>.js' adını alıyordu — uygulamanın kendi
             * giriş parçasıyla aynı desen. Ayırt edilemediği için önbelleğe
             * alınamıyor, çevrimdışıyken kelime ekleme sözlüğü boş görüyordu.
             */
            if (id.includes('src/data/extended/index.json')) {
              return 'extended-index';
            }
            if (id.includes('node_modules')) {
              return 'vendor';
            }
            return undefined;
          }
        }
      },
      chunkSizeWarningLimit: 800
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
