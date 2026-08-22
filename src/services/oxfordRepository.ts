/**
 * Anlora - Immutable Oxford 3000 Core Repository
 * 
 * ARCHITECTURAL MANDATES:
 * 1. Read-Only Core: Oxford 3000 is bundled seed data and cannot be modified, created, or deleted at runtime.
 * 2. Strict Separation: Oxford Core Dictionary is distinct from UserOxfordState (learned, favorite, review progress).
 * 3. Offline & Deterministic: 100% available offline with zero AI or network calls needed to view entries.
 * 4. Stable Identifiers: Canonical IDs are preserved across migrations and application updates.
 */

import { WordCard, Level, OxfordEntry } from '../types';
import wordsA1 from '../data/wordsA1.json';
import wordsA2 from '../data/wordsA2.json';
import wordsB1 from '../data/wordsB1.json';
import wordsB2 from '../data/wordsB2.json';

export const OXFORD_DATA_VERSION = '1.0.0';

export const OXFORD_METADATA = {
  datasetName: 'Oxford 3000',
  datasetVersion: OXFORD_DATA_VERSION,
  source: 'The Oxford 3000™ by CEFR level',
  isReadOnly: true as const
};

// Freeze the raw datasets in memory to strictly guarantee immutability
const RAW_A1: readonly WordCard[] = Object.freeze(wordsA1 as unknown as WordCard[]);
const RAW_A2: readonly WordCard[] = Object.freeze(wordsA2 as unknown as WordCard[]);
const RAW_B1: readonly WordCard[] = Object.freeze(wordsB1 as unknown as WordCard[]);
const RAW_B2: readonly WordCard[] = Object.freeze(wordsB2 as unknown as WordCard[]);

const ALL_ENTRIES: readonly WordCard[] = Object.freeze([
  ...RAW_A1,
  ...RAW_A2,
  ...RAW_B1,
  ...RAW_B2
]);

// Fast lookup map by ID
const ENTRY_MAP = new Map<string, WordCard>();
ALL_ENTRIES.forEach((entry) => {
  ENTRY_MAP.set(entry.id, entry);
});

/**
 * Sözlükte geçen tüm yazımlar (küçük harfe indirgenmiş).
 *
 * Bir dizeyi "gerçek bir İngilizce kelime mi?" diye sormak için kullanılır:
 * yazım toleransının başka bir kelimeyi doğru sayması ve lemmatizer'ın
 * var olmayan taban biçimler uydurması bu kümeyle önlenir. Bir kez kurulur;
 * her sorgu O(1)'dir.
 */
const KNOWN_WORDS = new Set<string>();
ALL_ENTRIES.forEach((entry) => {
  KNOWN_WORDS.add(entry.word.trim().toLowerCase());
  if (entry.lemma) KNOWN_WORDS.add(entry.lemma.trim().toLowerCase());
});

export const oxfordRepository = {
  /**
   * Get metadata regarding the Oxford Core Dataset
   */
  getMetadata() {
    return {
      ...OXFORD_METADATA,
      totalEntries: ALL_ENTRIES.length
    };
  },

  /**
   * Verilen dize sözlükte bir madde başı olarak geçiyor mu?
   * Yazım toleransı ve lemmatizer doğrulaması bunu kullanır.
   */
  isKnownWord(candidate: string): boolean {
    return KNOWN_WORDS.has((candidate || '').trim().toLowerCase());
  },

  /**
   * Total count of verified Oxford 3000 entries
   */
  count(): number {
    return ALL_ENTRIES.length;
  },

  /**
   * Retrieve all immutable Oxford 3000 entries (read-only)
   */
  getOxfordEntries(): readonly WordCard[] {
    return ALL_ENTRIES;
  },

  /**
   * Retrieve a single Oxford entry by its stable canonical ID
   */
  getOxfordEntry(id: string): WordCard | undefined {
    return ENTRY_MAP.get(id);
  },

  /**
   * Retrieve entries filtered by CEFR level
   */
  getOxfordEntriesByLevel(level: Level | 'ALL'): readonly WordCard[] {
    if (level === 'ALL') return ALL_ENTRIES;
    if (level === 'A1') return RAW_A1;
    if (level === 'A2') return RAW_A2;
    if (level === 'B1') return RAW_B1;
    if (level === 'B2') return RAW_B2;
    return ALL_ENTRIES.filter((e) => e.level === level);
  },

  /**
   * Fast text search across headwords, lemmas, and Turkish meanings
   */
  searchOxfordEntries(query: string, options?: { level?: Level | 'ALL'; partOfSpeech?: string }): WordCard[] {
    const q = query.trim().toLowerCase();
    const targetLevel = options?.level || 'ALL';
    const posFilter = options?.partOfSpeech && options.partOfSpeech !== 'ALL' ? options.partOfSpeech.toLowerCase() : null;

    const baseList = targetLevel === 'ALL' ? ALL_ENTRIES : this.getOxfordEntriesByLevel(targetLevel);

    return baseList.filter((entry) => {
      if (posFilter && !entry.partOfSpeech.toLowerCase().includes(posFilter)) {
        return false;
      }
      if (!q) return true;

      const matchesWord = entry.word.toLowerCase().includes(q);
      const matchesMeaning = entry.turkishMeaning.toLowerCase().includes(q);
      const matchesLemma = entry.lemma ? entry.lemma.toLowerCase().includes(q) : false;

      return matchesWord || matchesMeaning || matchesLemma;
    });
  },

  /**
   * Retrieve statistics by CEFR level dynamically computed from the core database
   */
  getOxfordStats(): { total: number; A1: number; A2: number; B1: number; B2: number } {
    return {
      total: ALL_ENTRIES.length,
      A1: RAW_A1.length,
      A2: RAW_A2.length,
      B1: RAW_B1.length,
      B2: RAW_B2.length
    };
  }
};
