/**
 * Anlora - Oxford 5000 Extra Core Repository (B2 Ek & C1)
 * 
 * ARCHITECTURAL MANDATES:
 * 1. Read-Only Core: Bundled static seed data, strictly immutable at runtime.
 * 2. Separate Collection: sourceCollection is "oxford5000-extra", completely distinct from Oxford 3000.
 * 3. Offline & Deterministic: 100% static data with zero runtime AI / network costs.
 * 4. Stable Identifiers: Deterministic IDs (e.g., ox5000-extra-b2-absorb-v).
 */

import { WordCard, Level } from '../types';
import { Oxford5000ExtraEntry } from '../types/oxfordExtra';
import wordsB2ExtraRaw from '../data/oxford5000ExtraB2.json';

export const OXFORD_5000_EXTRA_VERSION = '1.0.0';

export const OXFORD_5000_EXTRA_METADATA = {
  datasetName: 'Oxford 5000 – Ek 2000',
  datasetVersion: OXFORD_5000_EXTRA_VERSION,
  source: 'The Oxford 5000™ by CEFR level',
  isReadOnly: true as const
};

// Convert Oxford5000ExtraEntry to standard WordCard representation
export function extraEntryToWordCard(entry: Oxford5000ExtraEntry): WordCard {
  return {
    id: entry.id,
    word: entry.headword,
    headword: entry.headword,
    qualifier: entry.qualifier,
    partOfSpeech: entry.partOfSpeech,
    turkishMeaning: entry.turkishMeaning,
    otherMeanings: entry.turkishMeanings,
    level: entry.cefr as Level,
    sourceType: 'oxford',
    sourceEntryId: entry.id,
    examples: entry.senses[0]?.examples.map((ex) => ({
      en: ex.en,
      tr: ex.tr
    })) || [],
    senses: entry.senses.map((s, idx) => ({
      id: `${entry.id}-s${idx + 1}`,
      partOfSpeech: s.partOfSpeech || entry.partOfSpeech,
      turkishMeanings: s.turkishMeanings,
      examples: s.examples.map((ex) => ({
        en: ex.en,
        tr: ex.tr
      })),
      cefr: entry.cefr as Level
    }))
  };
}

const RAW_B2_EXTRA_ENTRIES: readonly Oxford5000ExtraEntry[] = Object.freeze(
  (wordsB2ExtraRaw || []) as Oxford5000ExtraEntry[]
);

const RAW_B2_EXTRA_WORDCARDS: readonly WordCard[] = Object.freeze(
  RAW_B2_EXTRA_ENTRIES.map(extraEntryToWordCard)
);

const ENTRY_MAP = new Map<string, WordCard>();
const RAW_ENTRY_MAP = new Map<string, Oxford5000ExtraEntry>();

RAW_B2_EXTRA_WORDCARDS.forEach((card, idx) => {
  ENTRY_MAP.set(card.id, card);
  const raw = RAW_B2_EXTRA_ENTRIES[idx];
  if (raw) {
    RAW_ENTRY_MAP.set(raw.id, raw);
  }
});

export const oxfordExtraRepository = {
  getMetadata() {
    return {
      ...OXFORD_5000_EXTRA_METADATA,
      totalEntries: RAW_B2_EXTRA_WORDCARDS.length
    };
  },

  count(): number {
    return RAW_B2_EXTRA_WORDCARDS.length;
  },

  /**
   * Get all Oxford 5000 Extra entries as standard WordCard models
   */
  getWordCards(): readonly WordCard[] {
    return RAW_B2_EXTRA_WORDCARDS;
  },

  /**
   * Get raw extra entries
   */
  getRawEntries(): readonly Oxford5000ExtraEntry[] {
    return RAW_B2_EXTRA_ENTRIES;
  },

  /**
   * Get single extra entry by ID
   */
  getWordCardById(id: string): WordCard | undefined {
    return ENTRY_MAP.get(id);
  },

  /**
   * Get raw entry by ID
   */
  getRawEntryById(id: string): Oxford5000ExtraEntry | undefined {
    return RAW_ENTRY_MAP.get(id);
  },

  /**
   * Fast search across Oxford 5000 Extra words
   */
  search(query: string, options?: { partOfSpeech?: string }): WordCard[] {
    const q = query.trim().toLowerCase();
    const posFilter = options?.partOfSpeech && options.partOfSpeech !== 'ALL' ? options.partOfSpeech.toLowerCase() : null;

    return RAW_B2_EXTRA_WORDCARDS.filter((card) => {
      if (posFilter && !card.partOfSpeech.toLowerCase().includes(posFilter)) {
        return false;
      }
      if (!q) return true;

      const wordMatch = card.word.toLowerCase().includes(q);
      const meaningMatch = card.turkishMeaning.toLowerCase().includes(q);
      const otherMatch = card.otherMeanings?.some((m) => m.toLowerCase().includes(q));
      const qualMatch = card.qualifier?.toLowerCase().includes(q);

      return wordMatch || meaningMatch || otherMatch || qualMatch;
    });
  }
};
