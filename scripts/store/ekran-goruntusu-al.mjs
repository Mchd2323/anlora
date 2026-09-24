/**
 * Play Store ekran görüntülerini gerçek uygulamadan alır.
 *
 * NEDEN TOHUM. Boş uygulamanın ekranı mağazada hiçbir şey anlatmıyor;
 * kullanıcı setleri ve ilerlemesi olan bir ekran görmek istiyor. Tohum
 * `tohum-uret.mjs` ile üretilir ve kelimeleri UYDURMAZ: hepsi paketteki
 * gerçek Oxford maddelerinden seçilir.
 *
 * 360x640 CSS * 3 = 1080x1920, tam 9:16 — Play'in her yerde kabul ettiği oran.
 *
 * Önce Vite'ı ayağa kaldır:
 *   npx vite --port 5199 --host 127.0.0.1
 * Sonra:
 *   node scripts/store/tohum-uret.mjs
 *   CHROMIUM_PATH=... node scripts/store/ekran-goruntusu-al.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const tohum = JSON.parse(fs.readFileSync('scripts/store/tohum.json','utf8'));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const p = await b.newPage({ viewport:{width:360,height:640}, deviceScaleFactor:3 });
await p.addInitScript(t => { for (const [k,v] of Object.entries(t)) localStorage.setItem(k,v); }, tohum);
await p.goto('http://127.0.0.1:5199/', { waitUntil:'networkidle', timeout:60000 });
await p.waitForTimeout(3500);

const sekme = async ad => { await p.getByRole('button',{name:ad,exact:false}).first().click({timeout:9000}); await p.waitForTimeout(1900); };
const kaydir = async px => { await p.mouse.wheel(0,px); await p.waitForTimeout(1300); };
const cek = async ad => { await p.screenshot({ path:`store/screenshots/${ad}.png` }); console.log('  ✓ '+ad); };

await cek('01-ana-sayfa');
/*
 * SABİT PİKSEL DEĞİL, ÇIPA.
 *
 * Burada `kaydir(800)` vardı. Düzen değişince (set kartları renk kazanıp
 * yükseldiğinde) o sayı listeyi ekranın DIŞINA itti ve görüntü boş bir
 * set panelini gösterdi — yani mağazaya konacak kare, anlatması gereken
 * şeyi hiç göstermiyordu. Sayı yerine "Set Listesi" başlığı görünüre
 * getiriliyor; düzen yine değişse bile kare doğru yere bakar.
 */
await sekme('Setlerim');
const setListesi = p.getByText('Set Listesi').first();
await setListesi.scrollIntoViewIfNeeded();
await p.waitForTimeout(900);
// Başlık görünüre geldikten sonra bir tık daha: üç set kartı da kareye girsin.
await kaydir(340);
await cek('02-setlerim');

await sekme('Oxford'); await kaydir(1150);
const ac = p.getByText('Tüm kelimeleri listele').first();
await ac.scrollIntoViewIfNeeded();
await p.waitForTimeout(600);
await ac.click({ timeout:9000 });
await p.waitForTimeout(2600);
await kaydir(300);
await cek('03-oxford-liste');

await sekme('Sınav'); await kaydir(430); await cek('04-sinav');
await sekme('Profil'); await kaydir(600); await cek('05-profil');
await b.close();
