import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Oxford sözlüğü yaklaşık 2,2 MB'lık JSON'dur ve uygulama kodundan
          // çok daha seyrek değişir. Ayrı bir parçaya alınınca kullanıcı
          // sözlüğü bir kez indirir ve sonraki dağıtımlarda önbellekten
          // kullanır; yalnızca uygulama parçası yeniden iner.
          //
          // NOT: Bu yalnızca önbelleklemeyi iyileştirir, ilk yükleme boyutunu
          // değil. Sözlük hâlâ açılışta baştan sona yükleniyor; asıl çözüm
          // `oxfordRepository`'yi seviye başına dinamik `import()` ile tembel
          // yüklemeye çevirmektir (README'de "Bilinen sınırlar").
          manualChunks(id: string) {
            if (id.includes('src/data/words') || id.includes('src/data/oxford5000')) {
              return 'oxford-data';
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
