/**
 * Anlora servis çalışanı.
 *
 * Uygulamanın tüm kullanıcı verisi zaten tarayıcıda (localStorage) duruyor;
 * çevrimdışı çalışmak için eksik olan tek şey uygulama kabuğunun kendisiydi.
 * Bu yüzden metroda ya da uçakta uygulama hiç açılmıyordu.
 *
 * Strateji:
 *   - Gezinme istekleri (sayfa açılışı): önce ağ, olmazsa önbellekteki kabuk.
 *     Böylece yeni dağıtımlar anında görünür ama çevrimdışıyken uygulama
 *     yine de açılır.
 *   - Statik varlıklar (JS, CSS, ikon, yazı tipi): önce önbellek, arka planda
 *     tazele. Sözlük verisi bu paketlerin içinde olduğu için ilk ziyaretten
 *     sonra tamamen çevrimdışı çalışır.
 *   - /api/ istekleri: asla önbelleğe alınmaz. Yapay zekâ üretimi ve
 *     senkronizasyon yanıtlarını saklamak yanlış olurdu.
 */

const VERSION = 'anlora-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Tek bir varlık indirilemezse kurulumun tamamı düşmesin.
      .then(cache => Promise.allSettled(SHELL_URLS.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => !key.startsWith(VERSION))
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Sayfa açılışı: önce ağ, çevrimdışıysa önbellekteki kabuk.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then(cache => cache.put('/index.html', copy));
          return response;
        })
        .catch(() =>
          caches
            .match('/index.html')
            .then(cached => cached || caches.match('/'))
            .then(
              cached =>
                cached ||
                new Response(
                  '<!doctype html><meta charset="utf-8"><p>Anlora çevrimdışı açılamadı.</p>',
                  { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                )
            )
        )
    );
    return;
  }

  // Statik varlıklar: önce önbellek, arka planda tazele.
  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
