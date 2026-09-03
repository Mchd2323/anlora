/**
 * Anlora – Genel Dağarcık (Oxford dışı yaygın kelimeler) ARAMA SERVİSİ.
 *
 * NE İŞE YARAR
 * Bu katman kullanıcıya gezilecek bir liste sunmaz. İşi, kullanıcı yeni bir
 * kelime eklerken sözlük olmaktır: yazdığı kelime burada varsa Türkçe anlamı
 * ve üç örnek cümlesi hazırdır, yapay zekâya hiç gerek kalmaz.
 *
 * NEDEN BANT İNDİRME KALDIRILDI
 * Önceki sürüm veriyi üç "bant" hâlinde sunuyor ve kullanıcıya hangisini
 * yükleyeceğini soruyordu. Bu yanlış bir soruydu: kimse hangi bantta hangi
 * kelimelerin olduğunu bilemez, dolayısıyla bilinçli bir seçim yapamaz.
 * Seçim ortadan kalktı; veri, ihtiyaç duyulduğu anda kendiliğinden gelir.
 *
 * TELEFONU YORMADAN
 * İki kademe vardır:
 *
 *   1. `index.json` (~50 KB) — yalnızca madde başları. Açılışta bir kez
 *      yüklenir. "Bu kelime sözlükte var mı?" sorusu bundan sonra bellekte,
 *      ağ ya da ayrıştırma maliyeti olmadan yanıtlanır.
 *   2. `w-<harf>.json` — o harfle başlayan kelimelerin tam kaydı. Yalnızca
 *      kullanıcı gerçekten o kelimeyi seçtiğinde yüklenir (ortalama ~138 KB).
 *      Yüklenen harf dosyaları önbellekte tutulur; aynı harften ikinci kelime
 *      bedava gelir.
 *
 * Toplam 4,5 MB'lık katmandan açılışta yalnızca 50 KB dokunulur.
 *
 * Salt okunur: Oxford verisinde olduğu gibi kullanıcı da çalışma zamanı da
 * bu veriyi değiştiremez; ağ ya da yapay zekâ çağrısı yoktur.
 */

import { WordCard } from '../types';
import { ExtendedEntry } from '../types/extended';

export const EXTENDED_DATA_VERSION = '2.0.0';

interface ExtendedIndex {
  version: number;
  wordCount: number;
  senseCount: number;
  letters: string[];
  words: string[];
}

let index: ExtendedIndex | null = null;
let indexWords: Set<string> = new Set();
let indexPromise: Promise<void> | null = null;

/** Yüklenmiş harf dosyaları: harf → madde başı → kayıt. */
const shardCache = new Map<string, Map<string, ExtendedEntry>>();
const shardPromises = new Map<string, Promise<Map<string, ExtendedEntry>>>();

import { aramaAnahtari } from '../utils/aramaAnahtari';

function normalize(word: string): string {
  // Dizinin kurulduğu anahtar ile aramanın ürettiği anahtar aynı olmalı;
  // aksi hâlde Türkçe klavyeyle yazılan sorgu dizini ıskalar.
  return aramaAnahtari(word);
}

function shardKeyOf(word: string): string {
  const first = normalize(word).slice(0, 1);
  return first >= 'a' && first <= 'z' ? first : '_';
}

/**
 * Madde başı dizinini yükler. Birden çok çağrı tek yüklemeye düşer.
 *
 * Açılışta çağrılabilecek kadar küçüktür; yine de uygulama kabuğu
 * boyandıktan sonra çağrılır ki ilk boyamayı geciktirmesin.
 */
export function loadExtendedIndex(): Promise<void> {
  if (index) return Promise.resolve();
  if (indexPromise) return indexPromise;

  indexPromise = import('../data/extended/index.json')
    .then(module => {
      index = (module.default || module) as unknown as ExtendedIndex;
      indexWords = new Set(index.words.map(normalize));
    })
    .catch(error => {
      // Başarısız yükleme önbelleğe yazılmasın; yeniden denenebilsin.
      indexPromise = null;
      throw error;
    });

  return indexPromise;
}

export function isExtendedIndexLoaded(): boolean {
  return index !== null;
}

/**
 * Bu kelime Genel Dağarcık'ta var mı?
 *
 * Eşzamanlıdır: dizin yüklendikten sonra kullanıcı her harfe bastığında
 * ağa ya da diske gitmeden yanıt verilebilsin diye.
 */
export function hasExtendedWord(word: string): boolean {
  return indexWords.has(normalize(word));
}

/**
 * Öneki eşleşen madde başları. Kullanıcı yazarken öneri göstermek için.
 */
export function suggestExtendedWords(prefix: string, limit = 8): string[] {
  const needle = normalize(prefix);
  if (!index || needle.length < 2) return [];

  const results: string[] = [];
  for (const word of index.words) {
    if (word.toLowerCase().startsWith(needle)) {
      results.push(word);
      if (results.length >= limit) break;
    }
  }
  return results;
}

async function loadShard(letter: string): Promise<Map<string, ExtendedEntry>> {
  const cached = shardCache.get(letter);
  if (cached) return cached;

  const pending = shardPromises.get(letter);
  if (pending) return pending;

  /*
   * Değişkenli dinamik `import()`. Vite bu kalıbı görüp `w-*.json`
   * dosyalarının tamamı için ayrı parçalar üretir; hangisinin isteneceğine
   * çalışma zamanında karar verilir. Yirmi altı sabit dal yazmak da olurdu
   * ama okunmaz bir switch bloğu oluştururdu.
   */
  const request = import(`../data/extended/w-${letter}.json`)
    .then(module => {
      const entries = (module.default || module) as unknown as ExtendedEntry[];
      const map = new Map<string, ExtendedEntry>();
      entries.forEach(entry => map.set(normalize(entry.headword), entry));
      shardCache.set(letter, map);
      shardPromises.delete(letter);
      return map;
    })
    .catch(error => {
      shardPromises.delete(letter);
      throw error;
    });

  shardPromises.set(letter, request);
  return request;
}

/**
 * Genel Dağarcık kaydını uygulamanın ortak `WordCard` görünümüne çevirir.
 *
 * `level` bilerek doldurulmaz: bu kelimelerin ölçülmüş bir CEFR seviyesi yok.
 * Alan boş kalınca arayüz CEFR rozetini kendiliğinden gizler; olmayan bir
 * seviye uydurulmamış olur.
 */
export function extendedEntryToWordCard(entry: ExtendedEntry): WordCard {
  const firstSenseWithExamples = entry.senses.find(sense => sense.examples.length > 0);

  return {
    id: entry.id,
    word: entry.headword,
    headword: entry.headword,
    partOfSpeech: entry.senses.map(sense => sense.partOfSpeech).join(', '),
    turkishMeaning: entry.senses
      .flatMap(sense => sense.turkishMeanings)
      .slice(0, 3)
      .join(', '),
    phonetic: entry.phonetic,
    sourceType: 'extended',
    sourceEntryId: entry.id,
    examples: firstSenseWithExamples ? firstSenseWithExamples.examples : [],
    examplesVerified: entry.senses.every(sense => sense.examples.length >= 3),
    senses: entry.senses.map(sense => ({
      id: sense.id,
      partOfSpeech: sense.partOfSpeech,
      turkishMeanings: sense.turkishMeanings,
      examples: sense.examples,
    })),
  };
}

/**
 * Kelimenin tam kaydını getirir; gerekiyorsa harf dosyasını yükler.
 * Sözlükte yoksa `undefined` döner.
 */
export async function getExtendedCard(word: string): Promise<WordCard | undefined> {
  const key = normalize(word);
  if (!key) return undefined;

  await loadExtendedIndex();
  if (!indexWords.has(key)) return undefined;

  const shard = await loadShard(shardKeyOf(key));
  const entry = shard.get(key);
  return entry ? extendedEntryToWordCard(entry) : undefined;
}

/** Dizin sayıları; arayüzde sabit sayı yazmak yerine buradan okunur. */
export function getExtendedStats(): { wordCount: number; senseCount: number } {
  return {
    wordCount: index?.wordCount ?? 0,
    senseCount: index?.senseCount ?? 0,
  };
}
