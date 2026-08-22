/**
 * Text Vocabulary Miner ("Metinden Kelime Yakala")
 * Extracts and categorizes English words from pasted paragraphs, articles, or subtitles.
 */

import { WordCard, LearningState, MinedWordItem, Level } from '../types';
import { normalizeWordString, findLemmaCandidate } from './lemmatizer';

// Common grammatical English stopwords to filter out from high-priority mining
const STOPWORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
  'is', 'are', 'was', 'were', 'am', 'been', 'has', 'had', 'did', 'does'
]);

export function mineVocabularyFromText(
  rawText: string,
  oxfordWords: WordCard[],
  customWords: WordCard[],
  learningStates: Record<string, LearningState>
): {
  totalExtracted: number;
  knownCount: number;
  oxfordCount: number;
  newCandidateCount: number;
  items: MinedWordItem[];
} {
  if (!rawText.trim()) {
    return {
      totalExtracted: 0,
      knownCount: 0,
      oxfordCount: 0,
      newCandidateCount: 0,
      items: []
    };
  }

  // Pre-build lookup maps
  const oxfordMap = new Map<string, WordCard>();
  oxfordWords.forEach(w => oxfordMap.set(normalizeWordString(w.word), w));

  const customMap = new Map<string, WordCard>();
  customWords.forEach(w => customMap.set(normalizeWordString(w.word), w));

  // Tokenize words
  const rawTokens = rawText
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .map(t => normalizeWordString(t))
    .filter(t => t.length >= 3 && !/^\d+$/.test(t));

  // Count word frequencies
  const frequencyMap = new Map<string, number>();
  rawTokens.forEach(token => {
    if (!STOPWORDS.has(token)) {
      frequencyMap.set(token, (frequencyMap.get(token) || 0) + 1);
    }
  });

  const items: MinedWordItem[] = [];
  let knownCount = 0;
  let oxfordCount = 0;
  let newCandidateCount = 0;

  frequencyMap.forEach((count, rawWord) => {
    const lemmaInfo = findLemmaCandidate(rawWord);
    const effectiveWord = lemmaInfo ? lemmaInfo.baseForm : rawWord;

    const matchedOxford = oxfordMap.get(effectiveWord) || oxfordMap.get(rawWord);
    const matchedCustom = customMap.get(effectiveWord) || customMap.get(rawWord);
    const matchedCard = matchedCustom || matchedOxford;

    let status: MinedWordItem['status'] = 'NEW';
    let level: Level | undefined = matchedCard?.level;

    if (matchedCard) {
      const state = learningStates[matchedCard.id];
      if (state && (state.stage === 'MASTERED' || state.stage === 'REVIEW')) {
        status = 'KNOWN';
        knownCount++;
      } else if (matchedCustom) {
        status = 'IN_SYSTEM';
        knownCount++;
      } else if (matchedOxford) {
        status = 'OXFORD_AVAILABLE';
        oxfordCount++;
      }
    } else {
      status = 'NEW';
      newCandidateCount++;
      // Estimate CEFR if unknown long word
      level = rawWord.length >= 8 ? 'B2' : 'B1';
    }

    items.push({
      rawWord,
      lemma: effectiveWord,
      count,
      status,
      level,
      matchedCard,
      suggestedMeaning: matchedCard?.turkishMeaning
    });
  });

  // Sort: NEW candidates first, then OXFORD_AVAILABLE, then highest frequency
  items.sort((a, b) => {
    const priority = { NEW: 1, OXFORD_AVAILABLE: 2, IN_SYSTEM: 3, KNOWN: 4 };
    if (priority[a.status] !== priority[b.status]) {
      return priority[a.status] - priority[b.status];
    }
    return b.count - a.count;
  });

  return {
    totalExtracted: frequencyMap.size,
    knownCount,
    oxfordCount,
    newCandidateCount,
    items
  };
}
