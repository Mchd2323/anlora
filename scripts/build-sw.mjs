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

/*
 * Yazı tipleri. fonts.css index.html'den bağlandığı için listeye kendiliğinden
 * giriyor ama İÇİNDEKİ woff2 dosyaları girmiyor: onlar CSS'in içinden
 * çağrılıyor ve bu betik yalnızca HTML'e bakıyor. Ön-önbelleğe alınmazlarsa
 * çevrimdışı açılışta arayüz sistem yazı tipine düşer — tam da gömmekle
 * çözdüğümüz sorun geri gelir.
 */
const fontDizini = path.join(distDir, 'fonts');
if (fs.existsSync(fontDizini)) {
  for (const dosya of fs.readdirSync(fontDizini)) {
    if (dosya.endsWith('.woff2')) referanslar.add(`/fonts/${dosya}`);
  }
}

/*
 * Oxford çekirdek sözlüğü. index.html'den bağlanmaz — uygulama açıldıktan
 * sonra dinamik `import()` ile gelir, bu yüzden yukarıdaki HTML taraması onu
 * görmez.
 *
 * Ön-önbelleğe alınması gerekiyor çünkü SÖZLÜK UYGULAMANIN KENDİSİ. İlk
 * ziyarette dosya, servis çalışanı sayfayı devralmadan önce indiği için
 * kendiliğinden önbelleğe girmiyordu; sonuç, çevrimdışı açılışta sonsuza
 * kadar "Sözlük hazırlanıyor…" yazan bir ekrandı (ölçüldü).
 *
 * Bedeli ilk ziyarette 3 MB'lık bir arka plan indirmesi. Bu indirme
 * kurulum sırasında olur, yani kullanıcı uygulamayı çoktan kullanmaya
 * başlamıştır. Alternatif — sözlüksüz bir çevrimdışı uygulama — hiçbir işe
 * yaramaz.
 *
 * Harf parçaları (w-a.js … w-z.js) ve kalıplar KASTEN dışarıda: onlar
 * isteğe bağlı katmanlar ve kullanıcı girdiğinde kendiliğinden önbelleğe
 * alınıyorlar.
 */
const varliklarDizini = path.join(distDir, 'assets');
if (fs.existsSync(varliklarDizini)) {
  for (const dosya of fs.readdirSync(varliklarDizini)) {
    // Oxford çekirdeği ve genişletilmiş sözlüğün dizini. İkisi de
    // çevrimdışı çalışmanın ön koşulu: biri kelimelerin kendisi, diğeri
    // "bu kelime sözlükte var mı" sorusunun yanıtı.
    if (/^(oxford-data|extended-index)-.*\.js$/.test(dosya)) referanslar.add(`/assets/${dosya}`);

    /*
     * Tema sahneleri. index.html'den değil, bileşenlerin içinden çağrıldıkları
     * için yukarıdaki HTML taraması onları da görmüyor. Dördü toplam ~290 KB;
     * ön-önbelleğe alınmazlarsa çevrimdışı açılışta ana sayfanın tanıtım
     * kartları ve Oxford kutusu boş çerçeveye düşer.
     */
    if (dosya.endsWith('.webp')) referanslar.add(`/assets/${dosya}`);
  }
}

/*
 * Sahneler gerçekten listeye girdi mi. Görseller yeniden adlandırılır ya da
 * başka bir klasöre taşınırsa yukarıdaki tarama sessizce hiçbir şey bulmaz;
 * bunun bedeli, ancak kullanıcı uçak modundayken fark edilen boş kartlardır.
 */
const sahneSayisi = [...referanslar].filter(y => y.endsWith('.webp')).length;
if (sahneSayisi < 4) {
  console.error(
    `build-sw: dist/assets içinde 4 tema sahnesi bekleniyordu, ${sahneSayisi} bulundu. ` +
      'Görseller taşınmış ya da yeniden adlandırılmış olabilir; eksik sahneyle çevrimdışı ' +
      'açılışta tanıtım kartları boş kalır.'
  );
  process.exit(1);
}

/*
 * ÜRETİLEN LİSTE DENETLENİYOR.
 *
 * Bu betik şimdiye kadar ne bulursa onu yazıyor, hiçbir şey bulamasa da 0
 * ile çıkıyordu. Oysa iki durumda ürettiği liste işe yaramaz ve bunu sessizce
 * yapması, hatanın ancak kullanıcının telefonunda anlaşılması demek:
 *
 *   - HTML taraması giriş paketini ya da stili yakalayamamışsa (vite çıktı
 *     biçimi değişirse) liste yalnızca kabuktan ibaret kalır.
 *   - Sözlük parçaları isimlendirme değiştiği için eşleşmezse (bu bir kez
 *     oldu: 3 MB'lık veri ana pakete düşmüştü) çevrimdışı açılış sonsuza
 *     kadar "Sözlük hazırlanıyor…" ekranında kalır.
 *
 * İkisi de derlemeyi kırmalı; çünkü ikisi de yeşil bir derlemeden çıkan
 * bozuk bir pakettir.
 */
const varlikVar = uzanti =>
  [...referanslar].some(yol => yol.startsWith('/assets/') && yol.endsWith(uzanti));

if (!varlikVar('.js') || !varlikVar('.css')) {
  console.error(
    'build-sw: index.html içinde /assets altında JS ya da CSS bağlantısı bulunamadı. ' +
      'Vite çıktısı beklenen biçimde değil; bu listeyle çevrimdışı açılış boş ekran verir.'
  );
  process.exit(1);
}

const zorunluParcalar = ['oxford-data', 'extended-index'];
const eksikParcalar = zorunluParcalar.filter(
  ad => ![...referanslar].some(yol => yol.startsWith(`/assets/${ad}-`) && yol.endsWith('.js'))
);
if (eksikParcalar.length > 0) {
  console.error(
    `build-sw: dist/assets içinde zorunlu sözlük parçası yok: ${eksikParcalar.join(', ')}. ` +
      "vite.config.ts'teki manualChunks kalıbı veri dosyası adıyla eşleşmiyor olabilir. " +
      'Sözlüksüz bir ön-önbellek listesi yayımlanamaz.'
  );
  process.exit(1);
}

const liste = ['/', '/index.html', ...[...referanslar].sort()];

/*
 * Sürüm etiketi ön-önbelleğe alınan dosyaların İÇERİĞİNDEN türüyor: yeni bir
 * dağıtımda etiket değişir, eski önbellekler activate sırasında silinir. Elle
 * artırılan bir sürüm numarası unutulmaya açıktı.
 *
 * Neden yalnızca yolları özetlemek yetmiyordu: listedeki girdilerin bir
 * bölümünün adı içerik özeti taşımıyor — /index.html, /manifest.webmanifest,
 * ikonlar, /fonts/fonts.css ve /fonts/*.woff2 her dağıtımda aynı adla çıkıyor.
 * Yalnızca bunlardan biri değiştiğinde (yazı tiplerini yeniden üretmek,
 * manifesti ya da bir ikonu düzenlemek, index.html'deki başlığı değiştirmek)
 * yollar aynı kaldığı için sürüm de aynı kalıyor ve üretilen sw.js bir önceki
 * dağıtımla BAYT BAYT aynı oluyordu. Tarayıcı servis çalışanını yalnızca bayt
 * farkına bakarak güncellediği için install/activate hiç çalışmıyordu: kurulu
 * cihazlarda install sırasında yazılan eski kopyalar (yazı tipleri, manifest,
 * ikonlar) SHELL_CACHE'te öylece kalıyor, ağdan gelen taze kopya ASSET_CACHE'e
 * yazılsa bile gölgede kalıyordu. Kullanıcı güncellemeyi hiç görmüyordu.
 *
 * Bedeli derleme başına listedeki dosyaların bir kez okunması (~4 MB); yalnızca
 * derleme zamanında, çalışma zamanında değil.
 */
const ozet = crypto.createHash('sha256');
for (const yol of liste) {
  // '/' diskte karşılığı olmayan sanal giriş; kabuğun kendisi index.html.
  // Geri kalan her yol listeye alınmadan önce existsSync ile süzüldü.
  const dosya = path.join(distDir, yol === '/' ? '/index.html' : yol);
  // Yol ile içerik arasına ayırıcı koyuyoruz ki sınırlar birbirine karışıp
  // iki farklı liste aynı özeti vermesin.
  ozet.update(yol);
  ozet.update('\0');
  ozet.update(fs.readFileSync(dosya));
  ozet.update('\0');
}
const surum = 'anlora-' + ozet.digest('hex').slice(0, 10);

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
