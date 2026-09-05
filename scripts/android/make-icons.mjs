/**
 * Anlora Realms logosundan uygulama simgelerini ve açılış ekranı logosunu üretir.
 *
 * KAYNAK: src/assets/brand/anlora-realms-logo.png — şeffaf zeminli logonun
 * kendisi. Web, PWA ve Android tek bir dosyadan türüyor, böylece simge üç
 * yüzeyde ayrışmıyor.
 *
 * Logoya YALNIZCA oranı koruyan ölçekleme uygulanıyor: kırpma yok, renk
 * değişikliği yok, filtre yok. Zemin rengi ayrı bir katman; logonun kendi
 * pikselleri hiç değişmiyor.
 *
 * GÜVENLİ ALAN. Uyarlanabilir (adaptive) simgede tuval 108 dp'dir ama Android
 * cihaza göre daire, yuvarlak kare ya da damla maskesi uygular; her maskede
 * görünmesi garanti olan bölge ortadaki 66 dp, yani %61. Logonun kendi iç
 * boşluğu yok (ölçüldü: kenarlarda yalnızca %1,5-2,7), bu yüzden boşluğu
 * burada veriyoruz — ön katmanda logo tuvalin %58'i. Tam kadraj verilseydi
 * yuvarlak maskede tacın uçları ve kitabın köşeleri kesilirdi.
 *
 * Çizim Chromium ile yapılıyor: depoya ayrıca bir görüntü işleme bağımlılığı
 * eklememek için, zaten var olan playwright-core kullanılıyor.
 *
 * Kullanım: node scripts/android/make-icons.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RES = path.join(ROOT, 'android/app/src/main/res');
const PUBLIC = path.join(ROOT, 'public');
const KAYNAK = path.join(ROOT, 'src/assets/brand/anlora-realms-logo.png');
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

/**
 * Simge zemini — PARŞÖMEN, LACİVERT DEĞİL.
 *
 * ÖLÇÜLDÜ: logonun görünür piksellerinin %57,9'u koyu (ortalama parlaklık
 * 93/255), çünkü arma ve kitap kuzey laciverti. Zemin de lacivert olunca
 * (eski değer #15283D) arma zemine karışıyor ve Android'in güvenlik/izin
 * ekranlarındaki küçük kutuda uygulama tanınmıyordu. Parşömen zeminde aynı
 * arma ve altın çizgiler net duruyor.
 *
 * Değeri `values/ic_launcher_background.xml` ile AYNI olmalı: uyarlanabilir
 * simgenin zemini oradan, eski (API < 26) simgelerin zemini buradan geliyor.
 */
const ZEMIN = '#F8F1E4';
/** Realms parşömeni — açılış ekranı zemini. */
const PARSOMEN = '#F2EBDD';

/** Yoğunluk çarpanları: mdpi 1x taban. */
const YOGUNLUK = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

if (!fs.existsSync(KAYNAK)) {
  console.error(`make-icons: kaynak logo yok: ${KAYNAK}`);
  process.exit(1);
}
const LOGO_URI = 'data:image/png;base64,' + fs.readFileSync(KAYNAK).toString('base64');

/**
 * Tek bir simge çizer.
 *
 * @param boy     kenar uzunluğu (px)
 * @param oran    logonun tuvale göre genişliği (0-1)
 * @param zemin   arka plan rengi, ya da null (şeffaf)
 * @param sekil   'kare' | 'yuvarlak-kare' | 'daire'
 */
async function ciz(sayfa, boy, oran, zemin, sekil) {
  return sayfa.evaluate(
    async ([uri, boy, oran, zemin, sekil]) => {
      const c = document.createElement('canvas');
      c.width = c.height = boy;
      const x = c.getContext('2d');

      if (zemin) {
        x.fillStyle = zemin;
        if (sekil === 'daire') {
          x.beginPath();
          x.arc(boy / 2, boy / 2, boy / 2, 0, Math.PI * 2);
          x.fill();
        } else if (sekil === 'yuvarlak-kare') {
          const r = boy * 0.22;
          x.beginPath();
          x.roundRect(0, 0, boy, boy, r);
          x.fill();
        } else {
          x.fillRect(0, 0, boy, boy);
        }
      }

      const im = new Image();
      im.src = uri;
      await im.decode();
      // Oranı koruyan ölçek: uzun kenar hedefe oturur, kırpma olmaz.
      const k = (boy * oran) / Math.max(im.width, im.height);
      const w = Math.round(im.width * k);
      const h = Math.round(im.height * k);
      x.imageSmoothingQuality = 'high';
      x.drawImage(im, Math.round((boy - w) / 2), Math.round((boy - h) / 2), w, h);

      return c.toDataURL('image/png').split(',')[1];
    },
    [LOGO_URI, boy, oran, zemin, sekil]
  );
}

const yaz = (yol, b64) => {
  fs.mkdirSync(path.dirname(yol), { recursive: true });
  fs.writeFileSync(yol, Buffer.from(b64, 'base64'));
};

const tarayici = await chromium.launch({ executablePath: EXE });
const sayfa = await (await tarayici.newContext()).newPage();
await sayfa.goto('about:blank');

for (const [ad, kat] of Object.entries(YOGUNLUK)) {
  // Uyarlanabilir ön katman: şeffaf, logo güvenli alanın içinde.
  yaz(path.join(RES, `mipmap-${ad}/ic_launcher_foreground.png`),
      await ciz(sayfa, Math.round(108 * kat), 0.58, null, 'kare'));
  // Eski (API < 26) simgeler: zemin katmanı yok, kendi zeminlerini taşırlar.
  yaz(path.join(RES, `mipmap-${ad}/ic_launcher.png`),
      await ciz(sayfa, Math.round(48 * kat), 0.62, ZEMIN, 'yuvarlak-kare'));
  yaz(path.join(RES, `mipmap-${ad}/ic_launcher_round.png`),
      await ciz(sayfa, Math.round(48 * kat), 0.58, ZEMIN, 'daire'));
  // Açılış ekranı logosu: 112 dp, katmanlı çizimde ortalanacak (bkz.
  // drawable/splash.xml — orada `gravity="center"` ile ölçeklenmeden çizilir).
  yaz(path.join(RES, `drawable-${ad}/splash_logo.png`),
      await ciz(sayfa, Math.round(112 * kat), 1, null, 'kare'));
}

// PWA ve tarayıcı simgeleri.
for (const boy of [192, 512]) {
  yaz(path.join(PUBLIC, `icon-${boy}.png`), await ciz(sayfa, boy, 0.70, ZEMIN, 'yuvarlak-kare'));
}
yaz(path.join(PUBLIC, 'icon-180.png'), await ciz(sayfa, 180, 0.70, ZEMIN, 'yuvarlak-kare'));
// Maskelenebilir simgede güvenli alan ortadaki %80; içerik %60'ta tutuluyor.
yaz(path.join(PUBLIC, 'icon-512-maskable.png'), await ciz(sayfa, 512, 0.60, ZEMIN, 'kare'));

await tarayici.close();
console.log('make-icons: Android simgeleri, açılış logosu ve PWA simgeleri üretildi.');
