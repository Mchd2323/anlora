/**
 * localStorage için güvenli sarmalayıcı.
 *
 * Doğrudan `localStorage.setItem` çağrısı üç durumda istisna fırlatır ve
 * uygulamayı çökertir:
 *   1. Kota dolduğunda (QuotaExceededError) — Anlora binlerce kelimenin
 *      öğrenme durumunu sakladığı için gerçek bir risk.
 *   2. Safari'nin gizli sekmesinde depolama tamamen kapalıyken.
 *   3. Tarayıcı ayarları site verisini engellediğinde.
 *
 * Bu sarmalayıcı yazma hatalarını yakalar, kota hatasında dinleyicilere haber
 * verir ve depolama hiç yoksa bellek içi bir yedeğe düşer.
 */

type StorageErrorListener = (error: unknown, key: string) => void;

const listeners = new Set<StorageErrorListener>();
const memoryFallback = new Map<string, string>();

let storageAvailable: boolean | null = null;

function isStorageAvailable(): boolean {
  if (storageAvailable !== null) return storageAvailable;
  try {
    const probe = '__anlora_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  return storageAvailable;
}

/**
 * Depolama yazma hatalarını dinlemek için kaydolur (ör. kullanıcıya toast
 * göstermek amacıyla). Aboneliği iptal eden fonksiyonu döner.
 */
export function onStorageError(listener: StorageErrorListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(error: unknown, key: string): void {
  listeners.forEach(listener => {
    try {
      listener(error, key);
    } catch {
      /* dinleyici hatası akışı bozmamalı */
    }
  });
}

export function readRaw(key: string): string | null {
  // Bellek yedeği yalnızca kalıcı yazması başarısız olan anahtarları tutar ve
  // bu değer diskteki eski sürümden daha günceldir; bu yüzden önce ona bakılır.
  // Aksi halde kota dolduğunda kullanıcı yaptığı değişikliğin aynı oturumda
  // anında kaybolduğunu görürdü.
  const pending = memoryFallback.get(key);
  if (pending !== undefined) return pending;

  if (!isStorageAvailable()) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * JSON değeri okur; anahtar yoksa veya içerik bozuksa `fallback` döner.
 */
export function readJSON<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

/**
 * JSON değeri yazar. Başarılıysa `true`, yazma başarısızsa `false` döner —
 * çağıran taraf istisna beklemek zorunda kalmaz.
 */
export function writeJSON(key: string, value: unknown): boolean {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch (err) {
    notify(err, key);
    return false;
  }

  if (!isStorageAvailable()) {
    memoryFallback.set(key, serialized);
    return false;
  }

  try {
    localStorage.setItem(key, serialized);
    memoryFallback.delete(key);
    return true;
  } catch (err) {
    // Kota hatasında veriyi en azından oturum boyunca bellekte tut.
    memoryFallback.set(key, serialized);
    notify(err, key);
    return false;
  }
}

/**
 * Ham dize yazar (JSON sarmalamadan). Göç bayrağı gibi işaretleyiciler için.
 */
export function writeRaw(key: string, value: string): boolean {
  if (!isStorageAvailable()) {
    memoryFallback.set(key, value);
    return false;
  }
  try {
    localStorage.setItem(key, value);
    memoryFallback.delete(key);
    return true;
  } catch (err) {
    memoryFallback.set(key, value);
    notify(err, key);
    return false;
  }
}

export function removeKey(key: string): void {
  memoryFallback.delete(key);
  if (!isStorageAvailable()) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* yoksayılabilir */
  }
}
