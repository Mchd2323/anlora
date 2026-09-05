/**
 * Arma plakasındaki logonun küçük WebP türevini üretir.
 *
 * NEDEN. `anlora-realms-logo.png` 512x512 ve 194 KB. Arayüzde tek yerde
 * kullanılıyor: üst başlıktaki arma plakası (`ArmaPlaka`, genişlik 38 px),
 * içindeki logo kutusu 22x25 CSS pikseli. Yani üç kat yoğunlukta bile 66x75
 * piksel yetiyor. Ölçüldü: açılışta inen 470 KB'nin en büyük tek kalemi bu
 * dosyaydı ve isteği tam React'in bağlandığı ana denk geliyordu.
 *
 * Büyük PNG SİLİNMİYOR: uygulama simgesini (`make-icons.mjs`) ve açılış
 * görselini (`make-splash.mjs`) üreten betikler onu diskten okuyor.
 *
 * Çıktı: 256x256 WebP — oran korunur, kırpma yok, renk değişikliği yok.
 *
 * Çalıştırma:  node scripts/make-logo-webp.mjs
 */
import pw from '../node_modules/playwright-core/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = pw;
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KAYNAK = path.join(KOK, 'src/assets/brand/anlora-realms-logo.png');
const HEDEF = path.join(KOK, 'src/assets/brand/anlora-realms-logo-256.webp');
const OLCU = 256;
const KALITE = 0.92;

const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const p = await b.newPage();
await p.setContent('<body></body>');
const src = 'data:image/png;base64,' + fs.readFileSync(KAYNAK).toString('base64');
const veri = await p.evaluate(
  async ({ src, olcu, kalite }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = olcu;
    c.height = Math.round((img.naturalHeight / img.naturalWidth) * olcu);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', kalite);
  },
  { src, olcu: OLCU, kalite: KALITE }
);
await b.close();
fs.writeFileSync(HEDEF, Buffer.from(veri.split(',')[1], 'base64'));
const eski = fs.statSync(KAYNAK).size;
const yeni = fs.statSync(HEDEF).size;
console.log(`${path.basename(HEDEF)}: ${yeni} bayt (kaynak ${eski} bayt, %${Math.round((1 - yeni / eski) * 100)} küçüldü)`);
