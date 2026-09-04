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
 * Bu sarmalayıcı yazma hatalarını yakalar, YAZMANIN başarısız olduğu her
 * durumda (kota dolu ya da depolama tümüyle kapalı) dinleyicilere haber verir
 * ve bellek içi bir yedeğe düşer. Okuma yolu bundan bağımsızdır: yazamamak
 * okuyamamak anlamına gelmez.
 */

type StorageErrorListener = (error: unknown, key: string) => void;

const listeners = new Set<StorageErrorListener>();
const memoryFallback = new Map<string, string>();

let canWrite: boolean | null = null;
let unavailableNotified = false;

/**
 * Deponun YAZILABİLİR olup olmadığını küçük bir yoklamayla ölçer.
 *
 * Yalnızca BAŞARI önbelleğe alınır. Eskiden başarısızlık da kalıcı olarak
 * önbelleğe alınıyordu: kullanıcı yer açsa (ya da depolamayı açsa) bile
 * uygulama yeniden başlatılana dek hiçbir şey kaydedilmiyordu. Başarısızlıkta
 * bayrağı boş bırakınca yazma yeteneği kendiliğinden geri gelir.
 *
 * Adı da anlamına uygun: bu yoklama YAZMA hakkında bir şey söyler, okuma
 * hakkında değil — okuma yolu bunu hiç sormamalıdır.
 */
function canWriteStorage(): boolean {
  if (canWrite === true) return true;
  try {
    const probe = '__anlora_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    canWrite = true;
  } catch {
    canWrite = null;
    return false;
  }
  return true;
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

/**
 * Depolama tümüyle kapalıyken kullanıcıyı bir kez uyarır.
 *
 * Bu dal eskiden sessizdi: gizli sekmede ya da site verisi engellenmişken
 * kullanıcı saatlerce çalışıyor, her şey belleğe yazılıyor, uygulama kapanınca
 * hepsi kayboluyordu — üstelik tek bir uyarı bile görmeden. Kota dalı zaten
 * haber veriyordu, bu unutulmuş dal değil bilinçli bir tercih değildi.
 *
 * Mandal şart: depolama kapalıyken açılış göçü ve her kart değerlendirmesi
 * ayrı bir yazma yapar; mandalsız hâlde ekran toast yığınıyla dolardı. Ancak
 * ToastProvider App'in ebeveyni olduğu ve React etkileri çocuktan ebeveyne
 * koştuğu için açılıştaki ilk bildirim henüz dinleyici yokken harcanabilir;
 * bu yüzden mandal ancak gerçekten dinleyen biri varken yanar.
 */
function notifyUnavailable(key: string): void {
  if (unavailableNotified) return;
  notify(new Error('storage-unavailable'), key);
  if (listeners.size > 0) unavailableNotified = true;
}

export function readRaw(key: string): string | null {
  // Bellek yedeği yalnızca kalıcı yazması başarısız olan anahtarları tutar ve
  // bu değer diskteki eski sürümden daha günceldir; bu yüzden önce ona bakılır.
  // Aksi halde kota dolduğunda kullanıcı yaptığı değişikliğin aynı oturumda
  // anında kaybolduğunu görürdü.
  const pending = memoryFallback.get(key);
  if (pending !== undefined) return pending;

  // Okuma yazma yeteneğine BAĞLANMAZ. Eskiden yoklama başarısızsa getItem hiç
  // denenmiyordu: depo tepesine kadar doluyken diskteki koleksiyonlar, öğrenme
  // durumları ve göç bayrakları görünmez oluyor, uygulama yeni kurulmuş gibi
  // açılıyor, göçler baştan koşuyordu — kullanıcının o ekranda "Tüm verileri
  // sıfırla"ya basması ise sağlam veriyi gerçekten siliyordu.
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

  if (!canWriteStorage()) {
    memoryFallback.set(key, serialized);
    notifyUnavailable(key);
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
  if (!canWriteStorage()) {
    memoryFallback.set(key, value);
    notifyUnavailable(key);
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
  // Silmek kotayı BOŞALTIR; yoklama başarısız diye silmeyi atlamak ters etki
  // yapıyordu — depo doluyken yer açmanın tek yolu kapanmış oluyordu.
  try {
    localStorage.removeItem(key);
  } catch {
    /* yoksayılabilir */
  }
}
