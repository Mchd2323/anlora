/**
 * Anlora marka ikonundan Android launcher ikonlarını üretir.
 *
 * Kaynak `public/icon.svg`; web, PWA ve Android tek bir işaretten türer,
 * böylece ikon üç yüzeyde ayrışmaz. Çizim Chromium ile yapılır — depoda
 * ikili görüntü aracı bulundurmamak için.
 *
 * Uyarlanabilir (adaptive) ikon iki katmandır: düz zemin rengi ve ortadaki
 * simge. Android katmanın dış %25'ini maskeleyebildiği için simge güvenli
 * alana sığacak şekilde küçültülür.
 *
 * Kullanım: node scripts/android/make-icons.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RES = path.join(ROOT, 'android/app/src/main/res');
const EXE = process.env.CHROMIUM_PATH || undefined;

/** mipmap yoğunlukları ve kenar uzunlukları (px). */
const DENSITIES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192
};

/** Uyarlanabilir ikon katmanı her zaman 108dp'lik tuvale çizilir. */
const FOREGROUND = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432
};

const BRAND_BG = '#4F46A5';
const MARK =
  'M256 97 91 415h72l31-60h124l31 60h72L256 97Zm0 96 48 93h-96l48-93Z';

/** Köşesi yuvarlatılmış klasik ikon. */
function squareSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="112" fill="${BRAND_BG}"/>
    <path d="${MARK}" fill="#F8F7F3"/>
  </svg>`;
}

/** Yuvarlak ikon (ic_launcher_round). */
function roundSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    <circle cx="256" cy="256" r="256" fill="${BRAND_BG}"/>
    <path d="${MARK}" fill="#F8F7F3"/>
  </svg>`;
}

/**
 * Uyarlanabilir ikonun ön katmanı: saydam zemin, ortada simge.
 * Simge 108'lik tuvalin ortadaki 72'lik güvenli alanına sığar.
 */
function foregroundSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 108 108">
    <g transform="translate(18 18) scale(${72 / 512})">
      <path d="${MARK}" fill="#F8F7F3"/>
    </g>
  </svg>`;
}

const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
const page = await browser.newPage();

async function render(svg, size, outPath) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;background:transparent">${svg}</body>`,
    { waitUntil: 'load' }
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await page.screenshot({ path: outPath, omitBackground: true });
}

for (const [dir, size] of Object.entries(DENSITIES)) {
  await render(squareSvg(size), size, path.join(RES, dir, 'ic_launcher.png'));
  await render(roundSvg(size), size, path.join(RES, dir, 'ic_launcher_round.png'));
}

for (const [dir, size] of Object.entries(FOREGROUND)) {
  await render(
    foregroundSvg(size),
    size,
    path.join(RES, dir, 'ic_launcher_foreground.png')
  );
}

// --- Açılış ekranı ---------------------------------------------------------
// Capacitor'ın varsayılanı beyaz zeminde Capacitor logosudur. Uygulamanın
// kendi zemin rengiyle (--bg) ve markasıyla değiştiriyoruz; böylece açılışta
// beyazdan krem zemine sıçrama olmuyor.

const SPLASH_BG = '#F8F7F3';

/** Ortada marka işareti olan düz zemin. İşaret kısa kenarın %22'si kadar. */
function splashSvg(width, height) {
  const mark = Math.round(Math.min(width, height) * 0.22);
  const x = Math.round((width - mark) / 2);
  const y = Math.round((height - mark) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="${SPLASH_BG}"/>
    <g transform="translate(${x} ${y}) scale(${mark / 512})">
      <path d="${MARK}" fill="${BRAND_BG}"/>
    </g>
  </svg>`;
}

/** Dikey açılış ekranı boyutları; yatay olanlar bunların devriğidir. */
const SPLASH_PORTRAIT = {
  mdpi: [320, 480],
  hdpi: [480, 800],
  xhdpi: [720, 1280],
  xxhdpi: [960, 1600],
  xxxhdpi: [1280, 1920]
};

async function renderSized(svg, width, height, outPath) {
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<body style="margin:0">${svg}</body>`,
    { waitUntil: 'load' }
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await page.screenshot({ path: outPath });
}

for (const [density, [w, h]] of Object.entries(SPLASH_PORTRAIT)) {
  await renderSized(
    splashSvg(w, h),
    w,
    h,
    path.join(RES, `drawable-port-${density}`, 'splash.png')
  );
  await renderSized(
    splashSvg(h, w),
    h,
    w,
    path.join(RES, `drawable-land-${density}`, 'splash.png')
  );
}

// Yoğunluk eşleşmezse kullanılan yedek.
await renderSized(splashSvg(480, 800), 480, 800, path.join(RES, 'drawable', 'splash.png'));

// Play Store listesi için 512×512 görsel.
await render(squareSvg(512), 512, path.join(ROOT, 'android/play-store-icon.png'));

await browser.close();
console.log('Android ikonları üretildi.');
