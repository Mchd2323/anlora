/**
 * Multi-Stage Duplicate & Conflict Detector
 * Performs fast, zero-API local normalization and hierarchical checks:
 * 1. Same collection duplicate?
 * 2. Another user collection duplicate?
 * 3. Oxford 3000 match?
 * 4. Inflected / Lemmatized base form match?
 */

import { WordCard, Collection, CollectionMembership, DuplicateCheckResult } from '../types';
import { normalizeWordString, findLemmaCandidate } from './lemmatizer';

/**
 * Normalize edilmiş kelime -> kart indeksi (önbellekli).
 *
 * Önceki sürüm her tekrar kontrolünde 3.900 kelimeyi düz tarıyor ve HER
 * karşılaştırmada `normalizeWordString` (beş ayrı düzenli ifade) çağırıyordu.
 * Toplu kelime ekleme ekranında 50 kelimelik bir liste ~200.000 regex işlemi
 * demekti ve orta seviye bir telefonda arayüz donuyordu.
 *
 * İndeks dizi kimliğine göre önbelleklenir: Oxford listesi uygulama boyunca
 * aynı donmuş dizidir, dolayısıyla bir kez kurulur. Özel kelimeler listesi
 * değiştiğinde yeni bir dizi referansı geldiği için indeks kendiliğinden
 * yenilenir.
 */
const indexCache = new WeakMap<readonly WordCard[], Map<string, WordCard>>();

function getWordIndex(words: readonly WordCard[]): Map<string, WordCard> {
  const cached = indexCache.get(words);
  if (cached) return cached;

  const index = new Map<string, WordCard>();
  for (const word of words) {
    const key = normalizeWordString(word.word);
    // İlk kayıt kazanır; aynı yazımın birden çok maddesi varsa (homograf)
    // hangisinin döneceği zaten belirsizdi, davranış korunuyor.
    if (key && !index.has(key)) index.set(key, word);

    if (word.canonicalWord) {
      const canonicalKey = normalizeWordString(word.canonicalWord);
      if (canonicalKey && !index.has(canonicalKey)) index.set(canonicalKey, word);
    }
  }

  indexCache.set(words, index);
  return index;
}

interface DuplicateCheckParams {
  rawWord: string;
  targetCollectionId?: string;
  collections: Collection[];
  memberships: CollectionMembership[];
  customWords: WordCard[];
  oxfordWords: WordCard[];
}

export function detectWordDuplicate(params: DuplicateCheckParams): DuplicateCheckResult {
  const {
    rawWord,
    targetCollectionId,
    collections,
    memberships,
    customWords,
    oxfordWords
  } = params;

  const normalized = normalizeWordString(rawWord);
  if (!normalized) {
    return {
      type: 'NONE',
      normalizedWord: ''
    };
  }

  // Build collection name map for quick lookup
  const collectionNameMap = new Map<string, string>();
  collections.forEach(c => collectionNameMap.set(c.id, c.name));

  // Build map of wordId -> collectionIds
  const wordToCollectionsMap = new Map<string, Set<string>>();
  memberships.forEach(m => {
    if (!wordToCollectionsMap.has(m.wordId)) {
      wordToCollectionsMap.set(m.wordId, new Set<string>());
    }
    wordToCollectionsMap.get(m.wordId)!.add(m.collectionId);
  });

  const customIndex = getWordIndex(customWords);
  const oxfordIndex = getWordIndex(oxfordWords);

  const matchedCustomWord = customIndex.get(normalized);
  const matchedOxfordWord = oxfordIndex.get(normalized);

  const matchedWord = matchedCustomWord || matchedOxfordWord;

  // 1. Check if present in target collection
  if (targetCollectionId && matchedWord) {
    const existingDecks = wordToCollectionsMap.get(matchedWord.id);
    if (existingDecks && existingDecks.has(targetCollectionId)) {
      const targetColName = collectionNameMap.get(targetCollectionId) || 'Bu Koleksiyon';
      return {
        type: 'EXACT_IN_COLLECTION',
        normalizedWord: normalized,
        matchedWordCard: matchedWord,
        matchedCollectionName: targetColName,
        matchedCollectionId: targetCollectionId,
        isInOxford: !!matchedOxfordWord,
        oxfordLevel: matchedOxfordWord?.level
      };
    }
  }

  // 2. Check if present in other user collections
  if (matchedWord && wordToCollectionsMap.has(matchedWord.id)) {
    const deckIds = Array.from(wordToCollectionsMap.get(matchedWord.id)!);
    const otherDeckNames = deckIds
      .filter(id => id !== targetCollectionId)
      .map(id => collectionNameMap.get(id) || 'Koleksiyon')
      .filter(Boolean);

    if (otherDeckNames.length > 0) {
      return {
        type: 'EXACT_IN_OTHER_COLLECTION',
        normalizedWord: normalized,
        matchedWordCard: matchedWord,
        otherCollectionNames: otherDeckNames,
        matchedCollectionName: otherDeckNames[0],
        isInOxford: !!matchedOxfordWord,
        oxfordLevel: matchedOxfordWord?.level
      };
    }
  }

  // 3. Check if present in Oxford 3000
  if (matchedOxfordWord) {
    return {
      type: 'EXACT_IN_OXFORD',
      normalizedWord: normalized,
      matchedWordCard: matchedOxfordWord,
      isInOxford: true,
      oxfordLevel: matchedOxfordWord.level
    };
  }

  // 4. Check for inflected lemma candidate.
  //
  // Taban biçim adayı sözlüğe karşı doğrulanır; böylece "stopp" gibi uydurma
  // tabanlar üretilip boşuna aranmaz.
  const isKnownWord = (candidate: string) =>
    oxfordIndex.has(candidate) || customIndex.has(candidate);
  const lemmaInfo = findLemmaCandidate(normalized, isKnownWord);
  if (lemmaInfo) {
    const baseMatchedOxford = oxfordIndex.get(lemmaInfo.baseForm);
    const baseMatchedCustom = customIndex.get(lemmaInfo.baseForm);
    const baseCard = baseMatchedCustom || baseMatchedOxford;

    if (baseCard) {
      return {
        type: 'INFLECTED_FORM',
        normalizedWord: normalized,
        matchedWordCard: baseCard,
        lemmaSuggestion: lemmaInfo,
        isInOxford: !!baseMatchedOxford,
        oxfordLevel: baseMatchedOxford?.level
      };
    }
  }

  // No duplicate found
  return {
    type: 'NONE',
    normalizedWord: normalized
  };
}
