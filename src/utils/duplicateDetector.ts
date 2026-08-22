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

  // Find matches in custom words
  const matchedCustomWord = customWords.find(
    w => normalizeWordString(w.word) === normalized || (w.canonicalWord && normalizeWordString(w.canonicalWord) === normalized)
  );

  // Find matches in Oxford words
  const matchedOxfordWord = oxfordWords.find(
    w => normalizeWordString(w.word) === normalized
  );

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

  // 4. Check for inflected lemma candidate
  const lemmaInfo = findLemmaCandidate(normalized);
  if (lemmaInfo) {
    // Check if the base form exists in Oxford or custom words
    const baseMatchedOxford = oxfordWords.find(w => normalizeWordString(w.word) === lemmaInfo.baseForm);
    const baseMatchedCustom = customWords.find(w => normalizeWordString(w.word) === lemmaInfo.baseForm);
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
