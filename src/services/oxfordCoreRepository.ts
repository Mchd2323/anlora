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
import oxford3000Raw from '../data/oxford3000.json';
import oxford5000ExtraRaw from '../data/oxford5000extra.json';

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

const ALL_ENTRIES: readonly OxfordEntry[] = Object.freeze([
  ...(oxford3000Raw as unknown as OxfordEntry[]),
  ...(oxford5000ExtraRaw as unknown as OxfordEntry[]),
]);

const ENTRY_BY_ID = new Map<string, OxfordEntry>();
const ENTRIES_BY_GROUP = new Map<OxfordGroupKey, OxfordEntry[]>();

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

const WORD_CARDS: readonly WordCard[] = Object.freeze(ALL_ENTRIES.map(entryToWordCard));
const WORD_CARD_BY_ID = new Map<string, WordCard>();
WORD_CARDS.forEach(card => WORD_CARD_BY_ID.set(card.id, card));

const CARDS_BY_GROUP = new Map<OxfordGroupKey, WordCard[]>();
ENTRIES_BY_GROUP.forEach((entries, group) => {
  CARDS_BY_GROUP.set(
    group,
    entries.map(entry => WORD_CARD_BY_ID.get(entry.id)!).filter(Boolean)
  );
});

/** Madde başı yazımları; yazım toleransı ve lemmatizer doğrulaması için. */
const KNOWN_WORDS = new Set<string>();
ALL_ENTRIES.forEach(entry => {
  KNOWN_WORDS.add(entry.headword.trim().toLowerCase());
  (entry.variants || []).forEach(variant => KNOWN_WORDS.add(variant.trim().toLowerCase()));
});

export const oxfordCoreRepository = {
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
