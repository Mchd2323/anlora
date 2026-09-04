/**
 * Anlora – Oxford Phrase List (kalıplar ve deyimler) SERVİSİ.
 *
 * NE VAR BURADA
 * A1'den C1'e 750 yaygın İngilizce kalıp: deyimler, öbek fiiller, birleşik
 * sözcükler, eş dizimler ve edatlı kalıplar. Başlıklar ve CEFR seviyeleri
 * Oxford Phrase List'ten; Türkçe anlamlar ve örnek cümleler ise sözlüğün
 * geri kalanıyla aynı hatta, elle yazılıp `scripts/phrases/build_phrases.py`
 * kalite kapısından geçirilmiştir.
 *
 * NEDEN OXFORD 5000'İN İÇİNE KARIŞTIRILMADI
 * Kalıplar seviyelere yayılır ama Oxford 5000'in seviye sayaçları kelime
 * sayar. 200 A1 kalıbını A1 grubuna katmak, kullanıcının "A1'de 900 kelime
 * var, 300'ünü bitirdim" şeklindeki ilerlemesini bozardı: payda birden
 * 1.100 olurdu ve bitmiş sayılan yüzde geriye giderdi. Kalıplar kendi
 * havuzunda durur, kendi seviye süzgeci vardır.
 *
 * TELEFONU YORMADAN
 * Tek dosya, tembel yüklenir (~500 KB). Açılışta hiç dokunulmaz; kullanıcı
 * kalıplar bölümüne girdiğinde ya da kelime eklerken sözlükte arama
 * yapıldığında bir kez indirilir ve bellekte kalır.
 *
 * Salt okunur: Oxford verisinde olduğu gibi ne kullanıcı ne çalışma zamanı
 * bu veriyi değiştirir; ağ ya da yapay zekâ çağrısı yoktur.
 */

import { Level, WordCard } from '../types';

export const PHRASE_DATA_VERSION = '1.0.0';

export interface PhraseEntry {
  id: string;
  headword: string;
  cefr: Level;
  sourceCollection: 'oxford-phrases';
  sourceOrder: number;
  sourceEntry: string;
  entryType: 'phrase' | 'idiom';
  /**
   * Kalıbın hangi biçimlerde kullanıldığı (Oxford listesindeki alt girdiler).
   * Tanım değildir; "a few" için "a few minutes", "a few times" gibi.
   */
  usages: string[];
  senses: {
    id: string;
    partOfSpeech: string;
    turkishMeanings: string[];
    examples: { en: string; tr: string }[];
  }[];
}

let entries: PhraseEntry[] | null = null;
let loadPromise: Promise<PhraseEntry[]> | null = null;
let byHeadword: Map<string, PhraseEntry> = new Map();

/**
 * Arama anahtarı.
 *
 * Kaynak listede yer tutucular var: "agree with sb", "arrive at…",
 * "a lot of sth". Kullanıcı bunları yazmaz; "agree with" ya da
 * "agree with him" yazar. Bu yüzden anahtar üretilirken yer tutucular ve
 * üç nokta atılır, kalan boşluklar sadeleşir.
 */
function normalize(phrase: string): string {
  return (phrase || '')
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/…/g, ' ')
    /*
     * Yer tutucular. Hepsi KÜÇÜK harfle yazılmalı: bir satır yukarıda
     * `.toLowerCase()` çalışıyor, dolayısıyla büyük harfli 'A and B' bu
     * noktada hiçbir zaman eşleşmiyordu — sözlükte o yer tutucuyu taşıyan
     * kalıp, kullanıcı doğru yazsa bile bulunamıyordu.
     */
    .replace(/\b(sb\/sth|sth\/sb|do sth|sb|sth|a and b)\b/g, ' ')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Kalıp verisini yükler. Birden çok çağrı tek indirmeyi paylaşır. */
export function loadPhrases(): Promise<PhraseEntry[]> {
  if (entries) return Promise.resolve(entries);
  if (loadPromise) return loadPromise;

  loadPromise = import('../data/phrases.json')
    .then(module => {
      const data = (module.default || module) as unknown as PhraseEntry[];
      entries = data;
      byHeadword = new Map();
      for (const entry of data) {
        const key = normalize(entry.headword);
        // Aynı anahtara düşen iki kalıp olabilir ("arrive at…" / "arrive in…"
        // farklı anahtarlar üretir ama yer tutucu temizliği bazı çiftleri
        // birleştirebilir). İlk gelen kalır: kaynak sırası korunur.
        if (key && !byHeadword.has(key)) byHeadword.set(key, entry);
      }
      return data;
    })
    .catch(() => {
      // Veri gelmezse uygulama kalıpsız çalışmaya devam eder; çökmek
      // kullanıcıya hiçbir şey kazandırmaz.
      entries = [];
      return entries;
    });

  return loadPromise;
}

export function isPhrasesLoaded(): boolean {
  return entries !== null;
}

export function phraseEntryToWordCard(entry: PhraseEntry): WordCard {
  const sense = entry.senses[0];
  return {
    id: entry.id,
    word: entry.headword,
    headword: entry.headword,
    partOfSpeech: 'phrase',
    entryType: entry.entryType,
    turkishMeaning: sense.turkishMeanings.join(', '),
    level: entry.cefr,
    sourceType: 'oxford',
    sourceEntryId: entry.id,
    examples: sense.examples,
    examplesVerified: sense.examples.length >= 3,
    collocations: entry.usages.length > 0 ? entry.usages : undefined,
    senses: entry.senses.map(s => ({
      id: s.id,
      partOfSpeech: s.partOfSpeech,
      turkishMeanings: s.turkishMeanings,
      examples: s.examples,
    })),
  };
}

/** Yüklüyse bütün kalıplar, değilse boş dizi. Liste ekranı bunu kullanır. */
export function getPhraseCards(): WordCard[] {
  return (entries || []).map(phraseEntryToWordCard);
}

/**
 * Kullanıcının yazdığı metne karşılık gelen kalıbı arar.
 *
 * Önce birebir eşleşme denenir; bulunamazsa kullanıcının yazdığı metnin bir
 * kalıpla BAŞLAYIP başlamadığına bakılır. "give up smoking" yazan biri
 * "give up" kalıbını kastediyordur; bunu bulamayıp yapay zekâya gitmek hem
 * yavaş hem gereksiz olurdu.
 */
export async function getPhraseCard(text: string): Promise<WordCard | undefined> {
  const key = normalize(text);
  if (!key) return undefined;

  await loadPhrases();

  const tam = byHeadword.get(key);
  if (tam) return phraseEntryToWordCard(tam);

  // En uzun eşleşen kalıp kazanır: "at the end of" için "at the end"den
  // önce "at the end of" seçilsin.
  let enIyi: PhraseEntry | undefined;
  let enIyiUzunluk = 0;
  byHeadword.forEach((entry, anahtar) => {
    if (anahtar.length <= enIyiUzunluk) return;
    if (key === anahtar || key.startsWith(anahtar + ' ')) {
      enIyi = entry;
      enIyiUzunluk = anahtar.length;
    }
  });

  return enIyi ? phraseEntryToWordCard(enIyi) : undefined;
}

/** Kalıp sayıları; arayüzde sabit sayı yazmak yerine buradan okunur. */
export function getPhraseStats(): { total: number; byLevel: Record<string, number> } {
  const byLevel: Record<string, number> = {};
  for (const entry of entries || []) {
    byLevel[entry.cefr] = (byLevel[entry.cefr] || 0) + 1;
  }
  return { total: (entries || []).length, byLevel };
}
