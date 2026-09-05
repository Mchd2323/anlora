/**
 * Ana sayfa manşet görsellerinin WebP türevlerini üretir.
 *
 * NEDEN. Paketin verdiği üç PNG 2172x724 ve ~2 MB. Manşet en geniş telefonda
 * 400 CSS pikseli genişliğinde çiziliyor; üç katı yoğunlukta bile 1200 piksel
 * yetiyor. Ham PNG'leri pakete koymak, açılışta 6 MB indirmek ve her birini
 * 1,5 megapiksel olarak çözmek demekti.
 *
 * Çıktı: 1400 piksel genişlik (oran korunur), WebP. Kırpma yok, renk
 * değişikliği yok — yalnızca ölçek ve biçim.
 *
 * Çalıştırma:  node scripts/make-carousel-webp.mjs [kaynak-dizin]
 */
import pw from '../node_modules/playwright-core/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = pw;
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KAYNAK = process.argv[2];
const HEDEF = path.join(KOK, 'src/assets/themes/realms/carousel');
const GENISLIK = 1400;
const KALITE = 0.86;

if (!KAYNAK) {
  console.error('Kaynak dizin verilmedi. Kullanım: node scripts/make-carousel-webp.mjs <dizin>');
  process.exit(1);
}

const DOSYALAR = ['carousel-stag-grove', 'carousel-storm-watchtower', 'carousel-oath-chamber'];

const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const p = await b.newPage();
await p.setContent('<body></body>');

fs.mkdirSync(HEDEF, { recursive: true });
for (const ad of DOSYALAR) {
  const kaynakYol = path.join(KAYNAK, `${ad}.png`);
  const src = 'data:image/png;base64,' + fs.readFileSync(kaynakYol).toString('base64');
  const { veri, w, h } = await p.evaluate(async ({ src, GENISLIK, KALITE }) => {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = src; });
    const oran = GENISLIK / img.width;
    const w = GENISLIK, h = Math.round(img.height * oran);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, w, h);
    return { veri: c.toDataURL('image/webp', KALITE), w, h };
  }, { src, GENISLIK, KALITE });

  if (!veri.startsWith('data:image/webp')) throw new Error('WebP üretilemedi: ' + ad);
  const buf = Buffer.from(veri.split(',')[1], 'base64');
  fs.writeFileSync(path.join(HEDEF, `${ad}.webp`), buf);
  const ham = fs.statSync(kaynakYol).size;
  console.log(`${ad}.webp  ${w}x${h}  ${(buf.length / 1024).toFixed(0)} KB  (kaynak ${(ham / 1024 / 1024).toFixed(2)} MB)`);
}
await b.close();
