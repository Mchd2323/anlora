/**
 * App Store ekran görüntülerini gerçek uygulamadan alır.
 *
 * Play Store'unkinden (scripts/store/ekran-goruntusu-al.mjs) AYRI bir dosya
 * olmasının sebebi ölçüler ve cihaz sayısı: Apple iki ayrı takım istiyor ve
 * ikisi de Play'in 1080x1920'sine uymuyor.
 *
 *   iPhone 6.9"  440x956 CSS  x3 = 1320x2868
 *   iPad 13"    1032x1376 CSS x2 = 2064x2752
 *
 * iPad takımı ZORUNLU, çünkü Xcode projesinde TARGETED_DEVICE_FAMILY "1,2"
 * (iPhone + iPad). iPad desteğini bırakırsan App Store Connect iPad
 * görüntülerini de ister. Uygulamanın iPad düzeni gerçekten farklı — alt
 * sekme çubuğu yerine üst gezinme, kartlar çok sütunlu — yani bu görüntüler
 * iPhone'unkilerin büyütülmüş hâli değil, başka bir arayüz gösteriyor.
 *
 * Tohum, Play tarafıyla aynı dosyadan gelir: kelimeler uydurulmaz, hepsi
 * paketteki gerçek Oxford maddelerinden seçilir.
 *
 * Kullanım:
 *   npx vite --port 5199 --host 127.0.0.1 &
 *   node scripts/store/tohum-uret.mjs
 *   CHROMIUM_PATH=... node scripts/store/ios-ekran-goruntusu-al.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const tohum = JSON.parse(fs.readFileSync('scripts/store/tohum.json', 'utf8'));

const CIHAZLAR = [
  { ad: 'iphone-6.9', genislik: 440,  yukseklik: 956,  olcek: 3 },
  { ad: 'ipad-13',    genislik: 1032, yukseklik: 1376, olcek: 2 }
];

const tarayici = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

for (const cihaz of CIHAZLAR) {
  const klasor = `store/ios/screenshots/${cihaz.ad}`;
  fs.mkdirSync(klasor, { recursive: true });

  const sayfa = await tarayici.newPage({
    viewport: { width: cihaz.genislik, height: cihaz.yukseklik },
    deviceScaleFactor: cihaz.olcek
  });
  await sayfa.addInitScript(t => {
    for (const [k, v] of Object.entries(t)) localStorage.setItem(k, v);
  }, tohum);
  await sayfa.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle', timeout: 60000 });
  await sayfa.waitForTimeout(3500);

  /*
   * Sekme adları iki düzende de aynı seçiciyle bulunur: telefonda alt
   * çubuktaki etiket "Setlerim", iPad'de üst çubuktaki "Kelime Setlerim".
   * `exact:false` ikisini de yakalar.
   */
  const sekme = async ad => {
    await sayfa.getByRole('button', { name: ad, exact: false }).first().click({ timeout: 9000 });
    await sayfa.waitForTimeout(1900);
  };
  const kaydir = async px => { await sayfa.mouse.wheel(0, px); await sayfa.waitForTimeout(1300); };
  const cek = async ad => {
    await sayfa.screenshot({ path: `${klasor}/${ad}.png` });
    console.log(`  ✓ ${cihaz.ad}/${ad}`);
  };

  console.log(`${cihaz.ad}  (${cihaz.genislik * cihaz.olcek}x${cihaz.yukseklik * cihaz.olcek})`);

  await cek('01-ana-sayfa');

  await sekme('Setlerim');
  await kaydir(cihaz.ad === 'ipad-13' ? 500 : 800);
  await cek('02-setlerim');

  await sekme('Oxford');
  await kaydir(cihaz.ad === 'ipad-13' ? 700 : 1150);
  const ac = sayfa.getByText('Tüm kelimeleri listele').first();
  await ac.scrollIntoViewIfNeeded();
  await sayfa.waitForTimeout(600);
  await ac.click({ timeout: 9000 });
  await sayfa.waitForTimeout(2600);
  await kaydir(300);
  await cek('03-oxford-liste');

  await sekme('Sınav');
  await kaydir(cihaz.ad === 'ipad-13' ? 250 : 430);
  await cek('04-sinav');

  await sekme('Profil');
  await kaydir(cihaz.ad === 'ipad-13' ? 350 : 600);
  await cek('05-profil');

  await sayfa.close();
}

await tarayici.close();
