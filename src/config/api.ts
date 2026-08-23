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

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim();

/** Sondaki eğik çizgi tekrarlı `//api` üretmesin. */
export const API_BASE = RAW_BASE.replace(/\/+$/, '');

/** Sunucuya bağlı özellikler kullanılabilir mi? */
export const HAS_REMOTE_API = API_BASE.length > 0 || !isNativeShell();

/**
 * Uygulama yerel bir pakete gömülü olarak mı çalışıyor?
 * Capacitor WebView'ında köken `capacitor://` ya da `https://localhost` olur.
 */
export function isNativeShell(): boolean {
  if (typeof window === 'undefined') return false;
  const proto = window.location.protocol;
  return proto === 'capacitor:' || proto === 'file:';
}

/** Göreli bir API yolunu çağrılabilir tam adrese çevirir. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${suffix}`;
}
