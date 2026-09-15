/**
 * Play Store öne çıkan görselini (1024x500) üretir.
 *
 * NEDEN BETİK. Görsel elle çizilseydi metni değiştiğinde (kelime sayısı
 * büyüdüğünde, slogan değiştiğinde) yeniden çizilmesi gerekirdi ve kimse
 * kaynağın nerede olduğunu bilemezdi. Kaynak `feature-graphic.html`;
 * burada yalnızca tarayıcıda açılıp ekran görüntüsü alınıyor.
 *
 * Kullanım:
 *   node scripts/store/make-feature-graphic.mjs
 *
 * Çıktı: store/feature-graphic-1024x500.png
 */
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const burasi = dirname(fileURLToPath(import.meta.url));
const kaynak = resolve(burasi, 'feature-graphic.html');
const cikti = resolve(burasi, '..', '..', 'store', 'feature-graphic-1024x500.png');

/*
 * Chromium yolu ortamdan okunur. Playwright'ın kendi indirdiği tarayıcı
 * PLAYWRIGHT_BROWSERS_PATH altında durur; yol verilmezse playwright-core
 * varsayılan konuma bakar ve bulunamazsa anlaşılır bir hata verir.
 */
const tarayiciYolu = process.env.CHROMIUM_PATH || undefined;

const tarayici = await chromium.launch(
  tarayiciYolu ? { executablePath: tarayiciYolu } : {}
);
const sayfa = await tarayici.newPage({
  viewport: { width: 1024, height: 500 },
  deviceScaleFactor: 1,
});
await sayfa.goto('file://' + kaynak);
// Yazı tiplerinin yerleşmesini bekle: erken çekilen görüntüde metin kayıyor.
await sayfa.waitForTimeout(400);
await sayfa.screenshot({ path: cikti });
await tarayici.close();

console.log('Yazıldı: ' + cikti);
