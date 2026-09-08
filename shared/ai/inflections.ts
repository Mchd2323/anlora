/**
 * Bir örnek cümle hedef kelimeyi GERÇEKTEN içeriyor mu?
 *
 * ÖLÇÜLEN SORUN. Doğrulayıcı bunu düz bir alt dize aramasıyla soruyordu:
 *
 *     if (!new RegExp(kelime, 'i').test(ornek.en)) return false;
 *
 * Düzensiz fiillerde bu koşul HİÇBİR ZAMAN sağlanamaz. "run" için doğal bir
 * örnek "She ran a marathon" olur ve içinde "run" harf dizisi yoktur. Sonuç
 * zincirleme: kart doğrulamadan geçemez, `handleGenerateWord` onu baştan
 * ürettirir (süre iki katına çıkar), ikinci deneme de aynı sebeple düşer ve
 * kullanıcı "Yapay zekâ kelime bilgilerini oluşturamadı" görür. go/went,
 * buy/bought, see/saw, take/took… hepsi aynı kapıya çarpıyordu.
 *
 * Kapı GEVŞETİLMİYOR. Örneğin kelimeyi taşıması hâlâ şart; değişen tek şey,
 * kelimenin çekimli biçimlerinin de o kelime sayılması. Alakasız bir cümle
 * yine reddedilir.
 *
 * DÜZENSİZ BİÇİMLER UYDURULMUYOR. `src/data/irregularInflections.json` zaten
 * bu iş için var ve sözlük derlemesinde kullanılıyordu; çalışma anındaki
 * doğrulayıcı ondan habersizdi. Aynı tablo burada da okunuyor, ikinci bir
 * kopya çıkarılmıyor.
 */

import DUZENSIZ from '../../src/data/irregularInflections.json';

/** Köke göre düzensiz yüzey biçimleri: "go" -> ["went", "gone", "goes"] */
const KOKTEN_BICIMLER: Record<string, string[]> = (() => {
  const harita: Record<string, string[]> = {};
  for (const [bicim, bilgi] of Object.entries(
    DUZENSIZ as Record<string, { base: string }>
  )) {
    const kok = (bilgi?.base || '').toLowerCase();
    if (!kok) continue;
    (harita[kok] ||= []).push(bicim.toLowerCase());
  }
  return harita;
})();

const SESLI = 'aeiou';

/**
 * Kuralı belli çekimler.
 *
 * Fazla üretmek zararsız: liste yalnızca "bu biçim de sayılır" demek için
 * kullanılıyor, sözlüğe yazılmıyor. Eksik bırakmanın bedeli ise doğru bir
 * kartın reddedilmesi.
 */
function duzenliBicimler(kelime: string): string[] {
  const k = kelime.toLowerCase();
  const bicimler = new Set<string>([k]);
  const son = k.slice(-1);
  const sondanIkinci = k.slice(-2, -1);

  bicimler.add(`${k}s`);
  bicimler.add(`${k}es`);
  bicimler.add(`${k}ed`);
  bicimler.add(`${k}d`);
  bicimler.add(`${k}ing`);
  bicimler.add(`${k}er`);
  bicimler.add(`${k}est`);

  // y -> ies / ied: carry -> carries, carried
  if (son === 'y' && sondanIkinci && !SESLI.includes(sondanIkinci)) {
    const govde = k.slice(0, -1);
    bicimler.add(`${govde}ies`);
    bicimler.add(`${govde}ied`);
    bicimler.add(`${govde}ier`);
    bicimler.add(`${govde}iest`);
  }

  // Sondaki sessiz e düşer: make -> making, made değil (o düzensiz)
  if (son === 'e') {
    const govde = k.slice(0, -1);
    bicimler.add(`${govde}ing`);
    bicimler.add(`${govde}ed`);
  }

  // Tek heceli, sessiz-sesli-sessiz: run -> running, stop -> stopped
  if (
    k.length >= 3 &&
    !SESLI.includes(son) &&
    son !== 'y' &&
    son !== 'w' &&
    sondanIkinci &&
    SESLI.includes(sondanIkinci) &&
    !SESLI.includes(k.slice(-3, -2) || 'a')
  ) {
    bicimler.add(`${k}${son}ing`);
    bicimler.add(`${k}${son}ed`);
    bicimler.add(`${k}${son}er`);
    bicimler.add(`${k}${son}est`);
  }

  return [...bicimler];
}

function kacir(deger: string): string {
  return deger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Hedef kelimenin bu cümlede sayılabilecek tüm yüzey biçimleri. */
export function kelimeBicimleri(kelime: string): string[] {
  const k = kelime.trim().toLowerCase();
  if (!k) return [];
  // Birden çok sözcüklü başlıklar (kalıplar, deyimler) çekilmez: "give up"
  // cümlede olduğu gibi aranır.
  if (/\s/.test(k)) return [k];
  return [...new Set([...duzenliBicimler(k), ...(KOKTEN_BICIMLER[k] || [])])];
}

/**
 * Cümle hedef kelimeyi (ya da çekimli bir biçimini) içeriyor mu?
 *
 * Sözcük sınırı aranıyor: "cat" için "concatenate" eşleşmemeli. Tek sözcüklü
 * başlıklarda sınır şart; çok sözcüklülerde düz alt dize yeterli, çünkü
 * kalıbın kendisi zaten sözcük sınırlarını taşıyor.
 */
export function cumledeGeciyorMu(cumle: string, kelime: string): boolean {
  const metin = (cumle || '').toLowerCase();
  if (!metin) return false;
  const bicimler = kelimeBicimleri(kelime);
  if (bicimler.length === 0) return true;

  return bicimler.some(bicim => {
    if (/\s/.test(bicim)) return metin.includes(bicim);
    return new RegExp(`(^|[^a-z])${kacir(bicim)}([^a-z]|$)`, 'i').test(metin);
  });
}
