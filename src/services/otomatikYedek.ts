import { Capacitor } from '@capacitor/core';
import { generateFullV2Backup } from '../utils/storageV2';
import { readRaw, writeRaw } from '../utils/safeStorage';

/**
 * Anlora – Kullanıcının haberi olmadan alınan yerel yedek.
 *
 * NEDEN VAR. Kullanıcı bir güncellemeden sonra bütün verisini kaybetti.
 * Kodda veriyi silen bir yol bulunamadı (göç var olanın üzerine yazmıyor,
 * imza sertifikası sürümler arasında aynı, yani üstüne kurulum veriyi
 * korur); geriye kalan yollar uygulamanın DIŞINDA: uygulamanın kaldırılıp
 * yeniden kurulması, "uygulama verilerini temizle" ve Google yedeğinin eski
 * bir kopyayı geri yüklemesi. Üçünün de ortak yanı şu: veri uygulamanın
 * ÖZEL dizinindeyse kurtarılamaz.
 *
 * Elle yedek alma zaten vardı ama kimse her gün elle yedek almaz; alınmayan
 * yedek yok hükmündedir. Bu dosya aynı işi kendiliğinden yapıyor.
 *
 * DOSYA UYGULAMANIN DIŞINA YAZILIYOR. `Directory.Documents` telefonun
 * belgeler klasörü; uygulama kaldırılsa bile orada kalıyor. Özel dizine
 * yazmak hiçbir şey çözmezdi -- kaybın olduğu yer tam olarak orası.
 *
 * ÜÇ KOPYA TUTULUYOR. Tek dosya olsaydı, veri kaybından SONRA açılan
 * uygulama boş durumu o tek dosyanın üzerine yazar ve son sağlam kopyayı da
 * yok ederdi. Tarihli üç dosya, bir günlük hatanın geçmişi silmesini
 * engelliyor.
 */

const SON_YEDEK_ANAHTARI = 'anlora.otomatikYedek.sonZaman';

/** Yedekler arası en az süre. */
export const YEDEK_ARALIGI_MS = 12 * 60 * 60 * 1000;

/** Diskte tutulan dosya sayısı. */
export const TUTULAN_KOPYA = 3;

const AD_ONEKI = 'anlora_otomatik_yedek_';

export interface YedekDurumu {
  /** Son yedeğin zamanı (ISO) ya da null. */
  sonZaman: string | null;
}

/**
 * Şimdi yedek alınmalı mı?
 *
 * Ağdan ve dosya sisteminden bağımsız saf işlev: asıl karar burada olduğu
 * için burada sınanıyor.
 *
 * @param veriVar Ortada yedeklenecek bir şey var mı? BOŞ DURUM ASLA
 *   YEDEKLENMEZ. Veri kaybından sonra açılan uygulama boş bir yedek yazsaydı,
 *   kurtarma dosyası da yok olurdu -- yani bu koşul, özelliğin kendi kendini
 *   baltalamasını önleyen şey.
 */
export function yedekGerekliMi(sonZaman: string | null, simdi: number, veriVar: boolean): boolean {
  if (!veriVar) return false;
  if (!sonZaman) return true;
  const damga = Date.parse(sonZaman);
  if (!Number.isFinite(damga)) return true;
  return simdi - damga >= YEDEK_ARALIGI_MS;
}

/** Dosya adlarından eskileri seçer; en yeni `TUTULAN_KOPYA` tanesi kalır. */
export function silinecekler(dosyalar: string[], tutulacak = TUTULAN_KOPYA): string[] {
  return dosyalar
    .filter(ad => ad.startsWith(AD_ONEKI) && ad.endsWith('.json'))
    .sort() // ad tarih taşıyor: alfabetik sıra zaman sırası
    .slice(0, Math.max(0, dosyalar.filter(ad => ad.startsWith(AD_ONEKI)).length - tutulacak));
}

export function sonYedekZamani(): string | null {
  return readRaw(SON_YEDEK_ANAHTARI);
}

/**
 * Gerekiyorsa yedeği alır. Hata fırlatmaz: yedekleme, uygulamanın asıl işini
 * hiçbir koşulda bozmamalı.
 *
 * @returns yazılan dosyanın adı, yazılmadıysa null.
 */
export async function otomatikYedekAl(veriVar: boolean): Promise<string | null> {
  try {
    if (!Capacitor.isNativePlatform()) return null;
    if (!yedekGerekliMi(sonYedekZamani(), Date.now(), veriVar)) return null;

    // Dinamik içe aktarma: tarayıcıda eklenti yok, statik import paketi
    // gereksiz büyütür ve yükleme sırasında hata verir.
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');

    const simdi = new Date();
    const ad = `${AD_ONEKI}${simdi.toISOString().slice(0, 10)}_${String(simdi.getHours()).padStart(2, '0')}.json`;
    await Filesystem.writeFile({
      path: ad,
      data: JSON.stringify(generateFullV2Backup()),
      directory: Directory.Documents,
      encoding: Encoding.UTF8
    });
    writeRaw(SON_YEDEK_ANAHTARI, simdi.toISOString());

    // Eski kopyaları temizle; başarısız olursa yedeğin kendisi geçerli kalır.
    try {
      const { files } = await Filesystem.readdir({ path: '', directory: Directory.Documents });
      const adlar = files.map(f => (typeof f === 'string' ? f : f.name));
      for (const eski of silinecekler(adlar)) {
        await Filesystem.deleteFile({ path: eski, directory: Directory.Documents });
      }
    } catch {
      /* temizlik başarısız: disk birkaç dosya fazla tutar, veri güvende */
    }

    return ad;
  } catch {
    return null;
  }
}
