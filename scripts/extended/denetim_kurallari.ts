/**
 * Anlora – üretilen sözlük içeriğinin biçim denetimi.
 *
 * NEDEN AYRI DOSYA. Kurallar `uret_icerik.ts` içindeydi; o dosya yüklenince
 * `main()` koşuyor, bu yüzden sınanamıyordu. Kurallar buraya alındı, üretici
 * ve testler aynı kaynağı kullanıyor.
 *
 * Kurallar `build_bands.py` içindeki `validate` ile aynı kapıyı hedefler:
 * oradan geçemeyen içerik pakete yazılmaz.
 */

export interface Ornek { en: string; tr: string }
export interface Anlam { turkishMeanings: string[]; examples: Ornek[] }

/** Türkçe mastar eki. Fiil karşılığı bununla biter, isim karşılığı bitmez. */
const MASTAR = /(mak|mek)$/;

/** Mastar gibi biten gerçek Türkçe isimler; fiil sanılıp elenmesinler. */
const MASTAR_ISIMLER = new Set(['yemek', 'ekmek', 'kaymak', 'çakmak', 'tokmak', 'ilmek', 'demek']);

/** Cümle kelimeyi içeriyor mu? build_bands.py ile aynı ölçüt. */
export function cumleIceriyor(cumle: string, kelime: string): boolean {
  return new RegExp(`\\b${kelime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(cumle);
}

/**
 * Karşılıkların türü, kelimenin türüne uyuyor mu?
 *
 * Türkçede fiil karşılığı mastar ekiyle biter ("kaçmak"), isim karşılığı
 * bitmez. Model isim kaydına fiil yazdığında bu yakalanır: bant 8'in ilk
 * partisinde inlay (n.) için "kakmak / işlemek" yazılmıştı, oysa isim
 * "kakma işi" demek; trudge (n.) için de fiil yazılmıştı.
 */
export function turUyumsuzlugu(pos: string, anlamlar: string[]): string | null {
  if (!anlamlar.length) return null;
  const mastar = anlamlar.filter(m => MASTAR.test(m.toLowerCase().trim()));
  if (pos === 'v.') {
    return mastar.length ? null : 'fiil ama karşılık mastar değil';
  }
  if (pos === 'n.' || pos === 'adj.' || pos === 'adv.') {
    const hepsi = mastar.length === anlamlar.length;
    const istisna = anlamlar.every(m => MASTAR_ISIMLER.has(m.toLowerCase().trim()));
    return hepsi && !istisna ? `${pos} ama karşılıkların hepsi fiil` : null;
  }
  return null;
}

/** build_bands.py `validate` ile aynı kurallar; üstüne tür tutarlılığı. */
export function sorunlar(kelime: string, a: Anlam, pos?: string): string[] {
  const s: string[] = [];
  const anlamlar = (a.turkishMeanings || []).map(m => String(m).trim()).filter(Boolean);
  if (!anlamlar.length) s.push('Türkçe anlam yok');
  else if (anlamlar.every(m => m.toLowerCase() === kelime.toLowerCase())) {
    s.push('anlam kelimenin kendisi');
  }
  if (pos && anlamlar.length) {
    const uyumsuz = turUyumsuzlugu(pos, anlamlar);
    if (uyumsuz) s.push(uyumsuz);
  }
  const ornekler = a.examples || [];
  if (ornekler.length < 3) s.push(`${ornekler.length} örnek`);
  const gorulen = new Set<string>();
  for (const o of ornekler) {
    const en = String(o?.en || '').trim();
    const tr = String(o?.tr || '').trim();
    if (!en || !tr) { s.push('örnek eksik çeviri'); continue; }
    if (gorulen.has(en.toLowerCase())) s.push('yinelenen örnek');
    gorulen.add(en.toLowerCase());
    if (!cumleIceriyor(en, kelime)) s.push(`örnek kelimeyi içermiyor: ${en}`);
  }
  return s;
}
