/**
 * API taban adresi.
 *
 * Web dağıtımında arayüz ile sunucu aynı kökenden servis edilir; göreli
 * `/api/...` yolları doğrudan çalışır ve taban boş kalır.
 *
 * Android (Capacitor) paketinde ise arayüz cihazdaki dosyalardan açılır ve
 * kökeni `https://localhost` olur. Göreli bir yol orada uygulamanın kendi
 * paketine gider, sunucuya değil. Bu yüzden APK derlenirken
 * `VITE_API_BASE_URL` ile sunucunun tam adresi verilir.
 *
 * Taban tanımlı değilse sunucuya bağlı özellikler (hesap, bulut yedeği,
 * Anlora AI) kapalıdır; Oxford çekirdeğiyle çalışma tamamen çevrimdışı
 * olduğu için uygulamanın ana işlevi bundan etkilenmez.
 */

import { Capacitor } from '@capacitor/core';

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim();

/** Sondaki eğik çizgi tekrarlı `//api` üretmesin. */
export const API_BASE = RAW_BASE.replace(/\/+$/, '');

/**
 * Sunucuya bağlı özellikler (hesap, bulut yedeği, Anlora AI) kullanılabilir mi?
 *
 * VARSAYIM DEĞİL, ÖLÇÜM.
 *
 * Önceki sürüm "web'de arayüz sunucusuyla aynı kökendedir, öyleyse sunucu
 * vardır" diye varsayıyordu. Bu her zaman doğru değil: uygulama statik olarak
 * da yayınlanabilir (yalnızca dosya sunan bir barındırma, ya da geliştirmede
 * `vite preview`). O durumda varsayım kullanıcıyı hiç açamayacağı bir giriş
 * kapısının arkasında bırakıyordu.
 *
 * Artık sunucuya gerçekten soruluyor. Sonuç önbelleklenir: her ekran için
 * yeniden yoklamak gereksiz gecikme olurdu.
 */
let remoteProbe: Promise<boolean> | null = null;

export async function hasRemoteApi(): Promise<boolean> {
  if (remoteProbe) return remoteProbe;

  remoteProbe = (async () => {
    try {
      /*
       * Kısa zaman aşımı: yanıt vermeyen bir adres yüzünden arayüz
       * beklemesin. Sunucu yoksa kullanıcı özelliğin kapalı olduğunu
       * hemen görür.
       */
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(apiUrl('/api/health'), {
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!response.ok) return false;

      // Sunucu yoksa statik barındırma ya da Capacitor kendi index.html'ini
      // 200 ile döndürür; JSON denetimi bu ikisini ayırır.
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return false;

      const data = await response.json();
      return data?.ok !== undefined;
    } catch {
      return false;
    }
  })();

  return remoteProbe;
}

/**
 * Uygulama yerel bir pakete gömülü olarak mı çalışıyor?
 *
 * Kökene bakmak yanıltıcıdır: Capacitor Android varsayılan olarak
 * `https://localhost` adresinden servis eder, yani şema tarayıcıdakiyle
 * aynıdır. Capacitor'ın kendi bildirimi tek güvenilir kaynaktır.
 */
export async function isNativeShell(): Promise<boolean> {
  // Statik içe aktarma: dinamik olanı gerçek cihazda asılı kalabiliyor
  // (bkz. utils/speech.ts başındaki açıklama).
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Göreli bir API yolunu çağrılabilir tam adrese çevirir. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${suffix}`;
}
