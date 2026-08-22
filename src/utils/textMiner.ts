/**
 * Text Vocabulary Miner ("Metinden Kelime Yakala")
 * Extracts and categorizes English words from pasted paragraphs, articles, or subtitles.
 */

import { WordCard, LearningState, MinedWordItem, Level } from '../types';
import { normalizeWordString, findLemmaCandidate } from './lemmatizer';

/**
 * Yalnızca dilbilgisel işlev sözcükleri.
 *
 * Önceki liste, "people", "work", "time", "year", "good", "know", "take",
 * "give", "make", "come", "look", "think", "use", "want", "first", "new"
 * gibi gerçek Oxford 3000 kelimelerini de eliyordu. Bunlar sık geçtikleri
 * için değil, ANLAM taşımadıkları varsayıldığı için listeye alınmıştı; oysa
 * hepsi A1/A2 seviyesinde öğrenilmesi gereken kelimeler. Sonuç: gerçek bir
 * başlangıç seviyesi öğrenci bir metni madenlediğinde tam da öğrenmesi
 * gereken kelimeleri hiç göremiyordu.
 *
 * Sıklık zaten ayrı bir sinyal ve kullanıcının kendi öğrenme durumu
 * (KNOWN / IN_SYSTEM) bildiği kelimeleri zaten aşağı çekiyor; bu listenin
 * işi yalnızca dilbilgisi iskeletini ayıklamak.
 */
const STOPWORDS = new Set([
  // artikeller, belirteçler
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'your', 'his',
  'her', 'its', 'our', 'their', 'some', 'any', 'each', 'every', 'no',
  // zamirler
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'us', 'them',
  'who', 'whom', 'whose', 'which', 'what', 'myself', 'yourself', 'himself',
  'herself', 'itself', 'ourselves', 'themselves',
  // yardımcı ve kip fiilleri
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'done', 'have', 'has', 'had', 'having',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
  // edatlar ve bağlaçlar
  'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'into', 'onto',
  'about', 'as', 'and', 'or', 'but', 'if', 'than', 'then', 'so', 'because',
  'while', 'when', 'where', 'there', 'here', 'not', 'nor',
]);

/** Metni cümlelere ayırır; bağlam yakalamak için kullanılır. */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 0);
}

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

  const isKnownWord = (candidate: string) =>
    oxfordMap.has(candidate) || customMap.has(candidate);

  /**
   * Kelimeleri taban biçimlerinde topla.
   *
   * Önceki sürümde sayaç ham yazıma göre tutuluyordu: "run", "running" ve
   * "ran" üç ayrı madde olarak listeleniyor, sıklıkları bölünüyordu. Artık
   * hepsi tek bir lemma altında birleşiyor ve toplam sıklık doğru çıkıyor.
   */
  interface Aggregate {
    lemma: string;
    count: number;
    forms: Set<string>;
    firstSentence?: string;
  }

  const aggregates = new Map<string, Aggregate>();
  const sentences = splitIntoSentences(rawText);

  sentences.forEach(sentence => {
    const tokens = sentence
      .replace(/[^\w\s'-]/g, ' ')
      .split(/\s+/)
      .map(token => normalizeWordString(token))
      .filter(token => token.length >= 3 && !/^\d+$/.test(token));

    tokens.forEach(token => {
      if (STOPWORDS.has(token)) return;

      // Taban biçim sözlüğe karşı doğrulanır; doğrulanamazsa ham yazım
      // korunur (uydurma bir taban üretmektense olduğu gibi bırakmak daha iyi).
      const lemmaInfo = findLemmaCandidate(token, isKnownWord);
      const lemma = lemmaInfo ? lemmaInfo.baseForm : token;
      if (STOPWORDS.has(lemma)) return;

      const existing = aggregates.get(lemma);
      if (existing) {
        existing.count += 1;
        existing.forms.add(token);
      } else {
        aggregates.set(lemma, {
          lemma,
          count: 1,
          forms: new Set([token]),
          firstSentence: sentence
        });
      }
    });
  });

  const items: MinedWordItem[] = [];
  let knownCount = 0;
  let oxfordCount = 0;
  let newCandidateCount = 0;

  aggregates.forEach(aggregate => {
    const { lemma, count, forms, firstSentence } = aggregate;
    const rawWord = Array.from(forms)[0];

    const matchedOxford = oxfordMap.get(lemma) || oxfordMap.get(rawWord);
    const matchedCustom = customMap.get(lemma) || customMap.get(rawWord);
    const matchedCard = matchedCustom || matchedOxford;

    let status: MinedWordItem['status'] = 'NEW';
    // Seviye yalnızca sözlükten okunur.
    //
    // Önceki sürüm bilinmeyen kelimeler için `rawWord.length >= 8 ? 'B2' : 'B1'`
    // diyordu. Bu uydurma bir sinyaldi: "beautiful" (9 harf) B2 çıkıyor ama
    // gerçekte A2; "gene" (4 harf) B1 çıkıyor ama C1. Kullanıcıya seviye
    // rozeti olarak gösterilen yanlış bir bilgi, hiç göstermemekten kötüdür.
    const level: Level | undefined = matchedCard?.level;

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
    }

    items.push({
      rawWord,
      lemma,
      count,
      status,
      level,
      matchedCard,
      suggestedMeaning: matchedCard?.turkishMeaning,
      contextSentence: firstSentence,
      observedForms: Array.from(forms)
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
    totalExtracted: aggregates.size,
    knownCount,
    oxfordCount,
    newCandidateCount,
    items
  };
}
