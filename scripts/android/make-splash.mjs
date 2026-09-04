/**
 * Acilis ekraninin gorselini uretir.
 *
 * NEDEN AYRI BIR BETIK. Acilis ekrani bir React ekrani degil; uygulama daha
 * baslamadan Android tarafindan cizilen bir drawable. Yani icerigi (arma,
 * "Anlora", "Words are power.", bezeme) derleme zamaninda GORSELE donmek
 * zorunda.
 *
 * NEDEN TEK PARCA DEGIL. Zemin rengi ve bezeme, esneyebilen bir katman
 * olmadan `drawable/splash.xml` icinde duruyor; burada uretilen tek sey
 * ORTADAKI blok (arma + yazi + ayrac). O blok `gravity="center"` ile kendi
 * boyutunda cizildigi icin hicbir ekranda esnemiyor.
 *
 * Cizim Chromium ile yapiliyor: depoda ayrica bir gorüntü isleme bagimliligi
 * tutmamak icin, zaten var olan playwright-core kullaniliyor.
 *
 * Kullanim: node scripts/android/make-splash.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RES = path.join(ROOT, 'android/app/src/main/res');
const LOGO = path.join(ROOT, 'src/assets/brand/anlora-realms-logo.png');
const FONT = path.join(ROOT, 'public/fonts/EBGaramond-normal-400-800-latin.woff2');
// Kalkan master paketinden; elle yeniden cizilmiyor.
const KALKAN = path.join(ROOT, 'src/assets/themes/realms/ornaments/crest-plaque.svg');
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

for (const yol of [LOGO, FONT, KALKAN]) {
  if (!fs.existsSync(yol)) {
    console.error(`make-splash: gerekli dosya yok: ${yol}`);
    process.exit(1);
  }
}
const b64 = yol => fs.readFileSync(yol).toString('base64');

/** Blogun mdpi (1x) olcusundeki boyutu, dp. */
const GENISLIK = 220;
const YUKSEKLIK = 210;
const YOGUNLUK = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const sayfaHtml = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'EB Garamond';src:url(data:font/woff2;base64,${b64(FONT)}) format('woff2');font-weight:400 800;}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent}
#blok{width:${GENISLIK}px;height:${YUKSEKLIK}px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:0;font-family:'EB Garamond',serif;color:#15283D}
/* Plaka paketin 64x72 oranini korur; yukseklik 112 dp. */
#arma{position:relative;width:99.6px;height:112px}
#arma .kalkan{position:absolute;inset:0;width:100%;height:100%}
/* Logonun kalkan icindeki yerlesimi de paketten: 9/8/10 piksel, oranli. */
#arma .isaret{position:absolute;top:14px;left:12.5px;width:74.6px;height:68.4px;object-fit:contain}
#ad{font-size:34px;font-weight:600;letter-spacing:0;margin-top:14px;line-height:1}
#ayrac{margin-top:10px;width:120px;height:9px}
#slogan{margin-top:9px;font-size:14px;font-weight:500;letter-spacing:.06em;color:#7A6127}
</style>
<div id="blok">
  <div id="arma">
    <img class="kalkan" src="data:image/svg+xml;base64,${b64(KALKAN)}" alt="">
    <img class="isaret" src="data:image/png;base64,${b64(LOGO)}" alt="">
  </div>
  <div id="ad">Anlora</div>
  <svg id="ayrac" viewBox="0 0 120 9" fill="none" stroke="#B79552" stroke-width="1" stroke-linecap="round">
    <path d="M2 4.5h40M78 4.5h40" opacity=".75"/>
    <path d="M60 1.4 63.6 4.5 60 7.6 56.4 4.5Z"/>
    <path d="M48 4.5h5M67 4.5h5" opacity=".6"/>
  </svg>
  <div id="slogan">Words are power.</div>
</div>`;

const tarayici = await chromium.launch({ executablePath: EXE });
for (const [ad, kat] of Object.entries(YOGUNLUK)) {
  const sayfa = await (await tarayici.newContext({ deviceScaleFactor: kat })).newPage();
  await sayfa.setViewportSize({ width: GENISLIK, height: YUKSEKLIK });
  await sayfa.setContent(sayfaHtml, { waitUntil: 'load' });
  await sayfa.evaluate(() => document.fonts.ready);
  const hedef = path.join(RES, `drawable-${ad}/splash_logo.png`);
  fs.mkdirSync(path.dirname(hedef), { recursive: true });
  await sayfa.locator('#blok').screenshot({ path: hedef, omitBackground: true });
  await sayfa.close();
}
await tarayici.close();
console.log('make-splash: acilis blogu 5 yogunlukta uretildi.');
