import { getUserSettings, saveUserSettings } from './storageV2';

/**
 * Telaffuz hızı: seçenekler, etiketler ve varsayılanın okunup yazılması.
 *
 * NEDEN AYRI BİR MODÜL. Hoparlör düğmesi uygulamanın dört ayrı ekranında
 * duruyor (Oxford kartı, set kartı, kart çalışması, çalışma seansı). Hızın
 * varsayılanını her birine prop olarak taşımak, dört ayrı yerde aynı bilgiyi
 * elden ele geçirmek demekti; biri unutulduğunda o ekran sessizce başka bir
 * hızda çalardı. Ayar tek yerden okunuyor.
 *
 * Değer `UserSettings` içinde saklanıyor — yani yedeğe de giriyor. Telefon
 * değiştiren kullanıcı hız tercihini de geri yükleyebiliyor; ayrı bir
 * localStorage anahtarı bunu kaçırırdı.
 */

/** Menüde ve ayarlarda sunulan hızlar. Sıra: doğaldan en yavaşa. */
export const HIZ_SECENEKLERI = [1, 0.75, 0.5, 0.25] as const;

export type TelaffuzHizi = (typeof HIZ_SECENEKLERI)[number];

/** Varsayılan: doğal hız. Etikette yazan hız, gerçekten çalınan hızdır. */
export const VARSAYILAN_HIZ: TelaffuzHizi = 1;

/**
 * Hızın kullanıcıya gösterilen adı.
 *
 * Türkçe ondalık ayracı virgüldür; "0.75×" yerine "0,75×" yazılıyor. En üstteki
 * seçenek "1×" yerine "Normal" diyor: kullanıcı doğal hızın hangisi olduğunu
 * bir sayıyı yorumlamadan görsün.
 */
export function hizEtiketi(hiz: number): string {
  if (hiz === 1) return 'Normal (1×)';
  return `${hiz.toString().replace('.', ',')}×`;
}

/** Menüdeki kısa rozet metni; yer dar olduğu için "Normal" yerine "1×". */
export function hizRozeti(hiz: number): string {
  return `${hiz.toString().replace('.', ',')}×`;
}

function gecerliMi(deger: unknown): deger is TelaffuzHizi {
  return (HIZ_SECENEKLERI as readonly number[]).includes(deger as number);
}

/** Kayıtlı varsayılan hız. Tanımsız ya da tanınmayan değer doğal hıza düşer. */
export function varsayilanHiziOku(): TelaffuzHizi {
  const deger = getUserSettings().speechRate;
  return gecerliMi(deger) ? deger : VARSAYILAN_HIZ;
}

/**
 * Varsayılan hızı değiştirir ve dinleyicilere haber verir.
 *
 * Haber vermek şart: kart üzerindeki menüden "tüm kartlarda kullan" denildiğinde
 * ekranda açık duran diğer kartların rozeti de anında güncellenmeli. Yalnızca
 * diske yazsaydık, kullanıcı aynı ekranda birbirinden farklı iki hız rozeti
 * görürdü.
 */
const dinleyiciler = new Set<(hiz: TelaffuzHizi) => void>();

export function varsayilanHiziYaz(hiz: TelaffuzHizi): void {
  const ayarlar = getUserSettings();
  saveUserSettings({ ...ayarlar, speechRate: hiz });
  dinleyiciler.forEach(fn => fn(hiz));
}

export function varsayilanHiziDinle(fn: (hiz: TelaffuzHizi) => void): () => void {
  dinleyiciler.add(fn);
  return () => {
    dinleyiciler.delete(fn);
  };
}
