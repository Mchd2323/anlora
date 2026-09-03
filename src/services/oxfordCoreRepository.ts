/**
 * Anlora – Oxford Çekirdek Sözlüğü (salt okunur).
 *
 * MİMARİ KURALLAR
 * 1. Salt okunur: Oxford verisi uygulamanın sabit kaynağıdır. Kullanıcı da
 *    çalışma zamanındaki yapay zekâ da bu veriyi değiştiremez.
 * 2. Kaynak ayrımı korunur: Oxford 3000 ile Oxford 5000 Ek ayrı dataset'tir.
 *    B2 Ek kelimeleri Oxford 3000 B2 ile karıştırılmaz.
 * 3. Çevrimdışı: veri pakete gömülüdür; ağ ya da yapay zekâ çağrısı yoktur.
 * 4. Kararlı kimlik: kimlikler deterministiktir, liste güncellendiğinde
 *    kaymaz; kullanıcı ilerlemesi bunlara bağlanır.
 *
 * Bu repository, `oxfordRepository` (Oxford 3000 düz model) ve
 * `oxfordExtraRepository` (B2 Ek) ikilisinin yerini alan tek giriş noktasıdır.
 */

import { WordCard, Level } from '../types';
import {
  OxfordEntry,
  OxfordGroupKey,
  getGroupKey,
  getPartOfSpeechLabel,
  getPrimaryMeaning,
  isEntryComplete,
} from '../types/oxford';
export const OXFORD_DATA_VERSION = '2.0.0';

export const OXFORD_GROUPS: {
  key: OxfordGroupKey;
  label: string;
  collection: 'oxford3000' | 'oxford5000-extra';
}[] = [
  { key: 'A1', label: 'A1', collection: 'oxford3000' },
  { key: 'A2', label: 'A2', collection: 'oxford3000' },
  { key: 'B1', label: 'B1', collection: 'oxford3000' },
  { key: 'B2', label: 'B2', collection: 'oxford3000' },
  { key: 'B2_EK', label: 'B2 Ek', collection: 'oxford5000-extra' },
  { key: 'C1', label: 'C1', collection: 'oxford5000-extra' },
];

/*
 * VERİ TEMBEL YÜKLENİR.
 *
 * Sözlük yaklaşık 5 MB JSON'dur. Önceki sürümde iki dosya da modül başında
 * statik olarak içe aktarılıyordu; bu, ayrıştırma ve 3.900 kartın nesneye
 * çevrilmesi bitene kadar TARAYICININ HİÇBİR ŞEY BOYAYAMAMASI demekti.
 * Ölçüm (4 kat yavaşlatılmış işlemci, mobil): bütün paketler 159 ms'de
 * iniyor, ilk boyama ise 12.688 ms'de yapılıyordu — kullanıcının "tıklayınca
 * geç açılıyor, takılıyor" dediği süre büyük ölçüde buydu.
 *
 * Artık veri `loadOxfordCore()` ile, uygulama kabuğu boyandıktan SONRA
 * yüklenir. Eşzamanlı okuyucular yükleme bitene kadar boş liste görür; bu
 * yüzden `isOxfordCoreLoaded()` vardır ve arayüz "sözlük hazırlanıyor"
 * durumunu dürüstçe gösterir.
 */

let ALL_ENTRIES: readonly OxfordEntry[] = [];
let ENTRY_BY_ID = new Map<string, OxfordEntry>();
let ENTRIES_BY_GROUP = new Map<OxfordGroupKey, OxfordEntry[]>();
let WORD_CARDS: readonly WordCard[] = [];
let WORD_CARD_BY_ID = new Map<string, WordCard>();
let CARDS_BY_GROUP = new Map<OxfordGroupKey, WordCard[]>();
let KNOWN_WORDS = new Set<string>();

let loaded = false;
let loadPromise: Promise<void> | null = null;

/** Sözlük belleğe alındı mı? */
export function isOxfordCoreLoaded(): boolean {
  return loaded;
}

/**
 * Sözlüğü yükler ve dizinleri kurar. Birden çok çağrı tek yüklemeye düşer.
 */
export function loadOxfordCore(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const [core, extra] = await Promise.all([
      import('../data/oxford3000.json'),
      import('../data/oxford5000extra.json'),
    ]);

    buildIndexes([
      ...((core.default || core) as unknown as OxfordEntry[]),
      ...((extra.default || extra) as unknown as OxfordEntry[]),
    ]);
    loaded = true;
  })().catch(error => {
    /*
     * BAŞARISIZ YÜKLEME ÖNBELLEĞE YAZILMASIN.
     *
     * Reddedilmiş söz `loadPromise`de kalırsa yukarıdaki erken dönüş her
     * çağrıda aynı reddi geri verir: yeniden deneme imkânsız hâle gelir ve
     * uygulama sonsuza kadar "Sözlük hazırlanıyor…" ekranında kilitlenir.
     * Kardeş servis (extendedRepository) bunu baştan doğru yapıyordu;
     * burada eksikti.
     */
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}

function buildIndexes(entries: OxfordEntry[]): void {
  ALL_ENTRIES = Object.freeze(entries);

  ENTRY_BY_ID = new Map();
  ENTRIES_BY_GROUP = new Map();

  ALL_ENTRIES.forEach(entry => {
    ENTRY_BY_ID.set(entry.id, entry);
    const group = getGroupKey(entry);
    const bucket = ENTRIES_BY_GROUP.get(group);
    if (bucket) {
      bucket.push(entry);
    } else {
      ENTRIES_BY_GROUP.set(group, [entry]);
    }
  });

  // Kaynak sırası korunur: listeler Oxford'un kendi düzeninde gösterilebilsin.
  ENTRIES_BY_GROUP.forEach(bucket => bucket.sort((a, b) => a.sourceOrder - b.sourceOrder));

  WORD_CARDS = Object.freeze(ALL_ENTRIES.map(entryToWordCard));
  WORD_CARD_BY_ID = new Map();
  WORD_CARDS.forEach(card => WORD_CARD_BY_ID.set(card.id, card));

  CARDS_BY_GROUP = new Map();
  ENTRIES_BY_GROUP.forEach((groupEntries, group) => {
    CARDS_BY_GROUP.set(
      group,
      groupEntries.map(entry => WORD_CARD_BY_ID.get(entry.id)!).filter(Boolean)
    );
  });

  KNOWN_WORDS = new Set();
  ALL_ENTRIES.forEach(entry => {
    KNOWN_WORDS.add(entry.headword.trim().toLowerCase());
    (entry.variants || []).forEach(variant => KNOWN_WORDS.add(variant.trim().toLowerCase()));
  });
}

/**
 * Oxford kaydını uygulamanın ortak `WordCard` görünümüne çevirir.
 *
 * Çalışma kartı, sınav ve listeler bu tip üzerinden çalıştığı için Oxford ve
 * kişisel kelimeler aynı bileşenleri paylaşabilir (talimat 43/56).
 */
export function entryToWordCard(entry: OxfordEntry): WordCard {
  const firstSenseWithExamples = entry.senses.find(sense => sense.examples.length > 0);

  return {
    id: entry.id,
    word: entry.headword,
    headword: entry.headword,
    qualifier: entry.qualifier,
    partOfSpeech: getPartOfSpeechLabel(entry),
    turkishMeaning: getPrimaryMeaning(entry),
    phonetic: entry.phonetic,
    level: entry.cefr as Level,
    sourceType: 'oxford',
    sourceEntryId: entry.id,
    examples: firstSenseWithExamples ? firstSenseWithExamples.examples : [],
    examplesVerified: entry.senses.some(sense => sense.examples.length >= 3),
    senses: entry.senses.map(sense => ({
      id: sense.id,
      partOfSpeech: sense.partOfSpeech,
      turkishMeanings: sense.turkishMeanings,
      examples: sense.examples,
      cefr: entry.cefr as Level,
    })),
  };
}

export const oxfordCoreRepository = {
  isLoaded: isOxfordCoreLoaded,
  load: loadOxfordCore,

  getMetadata() {
    const complete = ALL_ENTRIES.filter(isEntryComplete).length;
    return {
      datasetVersion: OXFORD_DATA_VERSION,
      source: 'The Oxford 3000™ / The Oxford 5000™ by CEFR level',
      isReadOnly: true as const,
      totalEntries: ALL_ENTRIES.length,
      uniqueHeadwords: KNOWN_WORDS.size,
      completeEntries: complete,
      needsReviewEntries: ALL_ENTRIES.length - complete,
    };
  },

  /** Tüm kayıtlar (ham model). */
  getEntries(): readonly OxfordEntry[] {
    return ALL_ENTRIES;
  },

  getEntryById(id: string): OxfordEntry | undefined {
    return ENTRY_BY_ID.get(id);
  },

  /** Tüm kayıtların `WordCard` görünümü. */
  getWordCards(): readonly WordCard[] {
    return WORD_CARDS;
  },

  getWordCardById(id: string): WordCard | undefined {
    return WORD_CARD_BY_ID.get(id);
  },

  /** Bir grubun (A1 … C1, B2 Ek) kayıtları, kaynak sırasında. */
  getEntriesByGroup(group: OxfordGroupKey): readonly OxfordEntry[] {
    return ENTRIES_BY_GROUP.get(group) || [];
  },

  getWordCardsByGroup(group: OxfordGroupKey): readonly WordCard[] {
    return CARDS_BY_GROUP.get(group) || [];
  },

  /** Grup başına kayıt sayısı. Arayüzde sabit sayı yazmak yerine buradan okunur. */
  getGroupCounts(): Record<OxfordGroupKey, number> {
    const counts = {} as Record<OxfordGroupKey, number>;
    OXFORD_GROUPS.forEach(group => {
      counts[group.key] = (ENTRIES_BY_GROUP.get(group.key) || []).length;
    });
    return counts;
  },

  /** Verilen dize sözlükte madde başı olarak geçiyor mu? */
  isKnownWord(candidate: string): boolean {
    return KNOWN_WORDS.has((candidate || '').trim().toLowerCase());
  },
};
