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

/**
 * Sunucuya bağlı özellikler (hesap, bulut yedeği, Anlora AI) kullanılabilir mi?
 *
 * Web'de arayüz sunucusuyla aynı kökendedir, taban boş olsa da göreli yol
 * çalışır. Yerel kabukta ise ancak tam bir adres verilmişse çalışır.
 */
export async function hasRemoteApi(): Promise<boolean> {
  if (API_BASE.length > 0) return true;
  return !(await isNativeShell());
}

/**
 * Uygulama yerel bir pakete gömülü olarak mı çalışıyor?
 *
 * Kökene bakmak yanıltıcıdır: Capacitor Android varsayılan olarak
 * `https://localhost` adresinden servis eder, yani şema tarayıcıdakiyle
 * aynıdır. Capacitor'ın kendi bildirimi tek güvenilir kaynaktır.
 */
export async function isNativeShell(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
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
