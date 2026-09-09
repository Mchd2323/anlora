import { readJSON, removeKey, writeJSON } from '../utils/safeStorage';

/**
 * Anlora – Toplu eklemenin kalıcı kuyruğu.
 *
 * NEDEN VAR. Yapay zekâ kart üretimi kelime başına yaklaşık sekiz saniye ve
 * istekler sırayla gidiyor; doksan sekiz kelimelik bir liste on üç dakika
 * demek. Bu iş toplu ekleme PENCERESİNİN içinde dönüyordu: kullanıcı pencereyi
 * kapatırsa ya da uygulamadan çıkarsa döngü ölüyor, kalan kelimeler hiç
 * eklenmiyor ve bunu söyleyen bir şey de olmuyordu. Kullanıcının on üç dakika
 * boyunca ekrana bakması bekleniyordu.
 *
 * Artık iş pencereden ayrı: kalan kelimeler diske yazılıyor, uygulama açıkken
 * arka planda işleniyor, uygulama kapanıp açılsa bile kaldığı yerden devam
 * ediyor.
 *
 * HEDEF SET KELİME BAŞINA SAKLANIYOR. Tek bir "bu kuyruk şu sete ait" alanı
 * daha basit olurdu ama kullanıcı bir üretim sürerken başka bir sete toplu
 * ekleme başlatırsa o kelimeler YANLIŞ SETE giderdi. Veriyi yanlış yere
 * yazmaktansa her öğeye kendi hedefini yazmak, birkaç bayta değer.
 *
 * DÜRÜST SINIR. Bu bir "gerçek arka plan servisi" değil. Android uygulamayı
 * tamamen arka plana aldığında WebView'i askıya alabilir; o sırada istekler
 * durur. Kaybolan bir şey olmaz -- kuyruk diskte durur ve uygulama öne
 * geldiğinde kaldığı yerden sürer. Ekran kapalıyken de üretimin sürmesi için
 * yerel bir ön plan servisi gerekir ki bu ayrı bir iştir.
 */

const ANAHTAR = 'anlora.topluKuyruk.v1';

export interface KuyrukOgesi {
  /** Kullanıcının yazdığı ham kelime. */
  kelime: string;
  /** Kartın ekleneceği set. */
  setId: string;
  /** Uyarı satırı için ad; set silinse bile metin anlamlı kalsın. */
  setAdi: string;
}

export interface TopluKuyruk {
  ogeler: KuyrukOgesi[];
  /** Kuyruğa toplam kaç öğe girdiği; ilerleme bunun üzerinden hesaplanır. */
  toplam: number;
  baslangic: string;
}

function gecerliMi(kayit: unknown): kayit is TopluKuyruk {
  const k = kayit as TopluKuyruk | null;
  return !!k && Array.isArray(k.ogeler) && typeof k.toplam === 'number';
}

export function kuyruguOku(): TopluKuyruk | null {
  const kayit = readJSON<TopluKuyruk | null>(ANAHTAR, null);
  if (!gecerliMi(kayit)) return null;
  // Boş kuyruk diskte kalmasın: uyarı satırı sonsuza kadar görünürdü.
  if (kayit.ogeler.length === 0) {
    removeKey(ANAHTAR);
    return null;
  }
  return kayit;
}

export function kuyrugaAl(setId: string, setAdi: string, kelimeler: string[]): TopluKuyruk | null {
  const yeniOgeler = kelimeler
    .map(k => k.trim())
    .filter(Boolean)
    .map(kelime => ({ kelime, setId, setAdi }));
  if (!yeniOgeler.length) return null;

  const mevcut = kuyruguOku();
  const yeni: TopluKuyruk = mevcut
    ? {
        ...mevcut,
        ogeler: [...mevcut.ogeler, ...yeniOgeler],
        toplam: mevcut.toplam + yeniOgeler.length
      }
    : {
        ogeler: yeniOgeler,
        toplam: yeniOgeler.length,
        baslangic: new Date().toISOString()
      };

  writeJSON(ANAHTAR, yeni);
  return yeni;
}

/**
 * İlk öğeyi kuyruktan düşürür ve kalanı diske yazar.
 *
 * İŞLENDİKTEN SONRA düşürülür, önce değil: uygulama tam o sırada kapanırsa
 * kelime kaybolmaz, yeniden denenir. Aynı kelimenin iki kez eklenmesi
 * ihtimali, hiç eklenmemesinden iyidir -- tekrar denetimi zaten ikinciyi
 * yakalar.
 */
export function ilkiniDusur(): TopluKuyruk | null {
  const kayit = kuyruguOku();
  if (!kayit) return null;
  const ogeler = kayit.ogeler.slice(1);
  if (!ogeler.length) {
    removeKey(ANAHTAR);
    return null;
  }
  const yeni = { ...kayit, ogeler };
  writeJSON(ANAHTAR, yeni);
  return yeni;
}

export function kuyrugaTemizle(): void {
  removeKey(ANAHTAR);
}

/** Belirli bir sette kaç kelime beklediği; uyarı satırı bunu yazıyor. */
export function settekiKalan(kayit: TopluKuyruk | null, setId: string): number {
  if (!kayit) return 0;
  return kayit.ogeler.filter(o => o.setId === setId).length;
}
