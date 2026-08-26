/**
 * Servis çalışanının ön-önbellek listesini derleme çıktısından üretir.
 *
 * Sorun: sw.js elle yazılmış sabit bir liste taşıyordu ve o listede yalnızca
 * kabuk (/, index.html, manifest, ikon) vardı. Uygulamayı asıl çalıştıran
 * JS ve CSS paketleri ise yalnızca servis çalışanı ÜZERİNDEN geçen bir
 * istekte önbelleğe giriyordu; ilk ziyarette bu paketler servis çalışanı
 * sayfayı devralmadan önce indiği için hiç kaydedilmiyordu. Sonuç:
 * çevrimdışı açılışta index.html geliyor ama paketler gelmiyor, ekran
 * bomboş kalıyordu (ölçüldü).
 *
 * Vite dosya adlarına içerik özeti kattığı için liste elle yazılamaz;
 * derlemeden sonra buradan üretiliyor.
 *
 * Ne ön-önbelleğe alınıyor: yalnızca açılış için gereken giriş paketleri,
 * stil dosyası ve simgeler. Sözlük parçaları (w-a.js … w-z.js, ~7 MB)
 * kasten dışarıda: ilk ziyarette 7 MB indirmek yerine, kullanıcı hangi
 * harfe girdiyse o parça önbelleğe alınıyor (sw.js'teki "önce önbellek"
 * kuralı bunu kendiliğinden yapıyor).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const distDir = path.join(process.cwd(), 'dist');
const swPath = path.join(distDir, 'sw.js');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(swPath) || !fs.existsSync(indexPath)) {
  console.error('build-sw: dist/sw.js veya dist/index.html yok. Önce vite build çalışmalı.');
  process.exit(1);
}

const html = fs.readFileSync(indexPath, 'utf8');

// index.html'in doğrudan yüklediği yerel varlıklar: giriş paketi ve stil.
const referanslar = new Set();
for (const m of html.matchAll(/(?:src|href)="(\/[^"]+)"/g)) {
  const yol = m[1];
  if (yol.startsWith('/api/')) continue;
  if (fs.existsSync(path.join(distDir, yol))) referanslar.add(yol);
}

// Kabuk: manifest ve simgeler index.html'de olmasa da gerekli.
for (const yol of ['/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png']) {
  if (fs.existsSync(path.join(distDir, yol))) referanslar.add(yol);
}

const liste = ['/', '/index.html', ...[...referanslar].sort()];

/*
 * Sürüm etiketi listenin içeriğinden türüyor: yeni bir dağıtımda paket
 * adları değişince etiket de değişir, eski önbellekler activate sırasında
 * silinir. Elle artırılan bir sürüm numarası unutulmaya açıktı.
 */
const surum = 'anlora-' + crypto.createHash('sha256').update(liste.join('|')).digest('hex').slice(0, 10);

let sw = fs.readFileSync(swPath, 'utf8');
const oncekiSurum = sw.match(/const VERSION = '([^']+)'/)?.[1];
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${surum}';`);
sw = sw.replace(
  /const SHELL_URLS = \[[\s\S]*?\];/,
  `const SHELL_URLS = ${JSON.stringify(liste, null, 2)};`
);

if (!sw.includes(surum) || !sw.includes('SHELL_URLS = [')) {
  console.error('build-sw: sw.js içindeki VERSION/SHELL_URLS bulunamadı, dosya beklenen biçimde değil.');
  process.exit(1);
}

fs.writeFileSync(swPath, sw);
console.log(`build-sw: ${liste.length} varlık ön-önbelleğe alınacak, sürüm ${surum}${oncekiSurum ? ` (önceki ${oncekiSurum})` : ''}`);
