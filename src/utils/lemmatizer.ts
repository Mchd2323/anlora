/**
 * Lemmatization, Inflection Normalization & Levenshtein utilities
 * Helps identify base forms (went -> go, studies -> study, children -> child)
 * and normalize apostrophes, punctuation, and casing.
 */

// Common English irregular past/participle/plural/comparative forms mapping
export const IRREGULAR_INFLECTIONS: Record<string, { base: string; type: string }> = {
  // Common irregular verbs
  went: { base: 'go', type: 'past form of go' },
  gone: { base: 'go', type: 'past participle of go' },
  goes: { base: 'go', type: '3rd person singular of go' },
  came: { base: 'come', type: 'past form of come' },
  comes: { base: 'come', type: '3rd person singular of come' },
  saw: { base: 'see', type: 'past form of see' },
  seen: { base: 'see', type: 'past participle of see' },
  took: { base: 'take', type: 'past form of take' },
  taken: { base: 'take', type: 'past participle of take' },
  got: { base: 'get', type: 'past form of get' },
  gotten: { base: 'get', type: 'past participle of get' },
  made: { base: 'make', type: 'past form of make' },
  knew: { base: 'know', type: 'past form of know' },
  known: { base: 'know', type: 'past participle of know' },
  thought: { base: 'think', type: 'past form of think' },
  bought: { base: 'buy', type: 'past form of buy' },
  brought: { base: 'bring', type: 'past form of bring' },
  caught: { base: 'catch', type: 'past form of catch' },
  taught: { base: 'teach', type: 'past form of teach' },
  felt: { base: 'feel', type: 'past form of feel' },
  found: { base: 'find', type: 'past form of find' },
  gave: { base: 'give', type: 'past form of give' },
  given: { base: 'give', type: 'past participle of give' },
  told: { base: 'tell', type: 'past form of tell' },
  became: { base: 'become', type: 'past form of become' },
  began: { base: 'begin', type: 'past form of begin' },
  begun: { base: 'begin', type: 'past participle of begin' },
  wrote: { base: 'write', type: 'past form of write' },
  written: { base: 'write', type: 'past participle of write' },
  spoke: { base: 'speak', type: 'past form of speak' },
  spoken: { base: 'speak', type: 'past participle of speak' },
  chose: { base: 'choose', type: 'past form of choose' },
  chosen: { base: 'choose', type: 'past participle of choose' },
  drank: { base: 'drink', type: 'past form of drink' },
  drunk: { base: 'drink', type: 'past participle of drink' },
  drove: { base: 'drive', type: 'past form of drive' },
  driven: { base: 'drive', type: 'past participle of drive' },
  ate: { base: 'eat', type: 'past form of eat' },
  eaten: { base: 'eat', type: 'past participle of eat' },
  fell: { base: 'fall', type: 'past form of fall' },
  fallen: { base: 'fall', type: 'past participle of fall' },
  flew: { base: 'fly', type: 'past form of fly' },
  flown: { base: 'fly', type: 'past participle of fly' },
  forgot: { base: 'forget', type: 'past form of forget' },
  forgotten: { base: 'forget', type: 'past participle of forget' },
  grew: { base: 'grow', type: 'past form of grow' },
  grown: { base: 'grow', type: 'past participle of grow' },
  heard: { base: 'hear', type: 'past form of hear' },
  kept: { base: 'keep', type: 'past form of keep' },
  left: { base: 'leave', type: 'past form of leave' },
  lost: { base: 'lose', type: 'past form of lose' },
  met: { base: 'meet', type: 'past form of meet' },
  paid: { base: 'pay', type: 'past form of pay' },
  ran: { base: 'run', type: 'past form of run' },
  said: { base: 'say', type: 'past form of say' },
  sold: { base: 'sell', type: 'past form of sell' },
  sent: { base: 'send', type: 'past form of send' },
  sat: { base: 'sit', type: 'past form of sit' },
  slept: { base: 'sleep', type: 'past form of sleep' },
  stood: { base: 'stand', type: 'past form of stand' },
  swam: { base: 'swim', type: 'past form of swim' },
  swum: { base: 'swim', type: 'past participle of swim' },
  understood: { base: 'understand', type: 'past form of understand' },
  woke: { base: 'wake', type: 'past form of wake' },
  woken: { base: 'wake', type: 'past participle of wake' },
  wore: { base: 'wear', type: 'past form of wear' },
  worn: { base: 'wear', type: 'past participle of wear' },
  won: { base: 'win', type: 'past form of win' },

  // Common irregular plurals
  children: { base: 'child', type: 'plural of child' },
  people: { base: 'person', type: 'plural of person' },
  men: { base: 'man', type: 'plural of man' },
  women: { base: 'woman', type: 'plural of woman' },
  teeth: { base: 'tooth', type: 'plural of tooth' },
  feet: { base: 'foot', type: 'plural of foot' },
  mice: { base: 'mouse', type: 'plural of mouse' },
  geese: { base: 'goose', type: 'plural of goose' },
  lives: { base: 'life', type: 'plural of life' },
  knives: { base: 'knife', type: 'plural of knife' },
  halves: { base: 'half', type: 'plural of half' },
  leaves: { base: 'leaf', type: 'plural of leaf' },

  // Common irregular comparatives / superlatives
  better: { base: 'good', type: 'comparative of good / well' },
  best: { base: 'good', type: 'superlative of good / well' },
  worse: { base: 'bad', type: 'comparative of bad' },
  worst: { base: 'bad', type: 'superlative of bad' },
  farther: { base: 'far', type: 'comparative of far' },
  further: { base: 'far', type: 'comparative of far' },
  farthest: { base: 'far', type: 'superlative of far' },
  furthest: { base: 'far', type: 'superlative of far' },
  less: { base: 'little', type: 'comparative of little' },
  least: { base: 'little', type: 'superlative of little' },
  more: { base: 'much', type: 'comparative of much / many' },
  most: { base: 'much', type: 'superlative of much / many' }
};

/**
 * Normalizes input string for robust duplicate checks:
 * - Unifies curly/typographic quotes to standard single quote '
 * - Trims whitespace and collapses multiple spaces
 * - Lowercases for case-insensitive matching
 * - Strips leading/trailing punctuation characters
 */
export function normalizeWordString(input: string): string {
  if (!input) return '';
  return input
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035`]/g, "'") // curly quotes
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036"]/g, '') // double quotes
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // collapse multi-spaces
    .replace(/^[^\w']+|[^\w']+$/g, ''); // strip leading/trailing non-alphanumeric except apostrophe
}

/**
 * Detects base lemma candidates for an English word
 */
export function findLemmaCandidate(normalizedWord: string): { baseForm: string; explanation: string } | null {
  if (!normalizedWord || normalizedWord.length < 3) return null;

  // 1. Direct dictionary match
  if (IRREGULAR_INFLECTIONS[normalizedWord]) {
    const item = IRREGULAR_INFLECTIONS[normalizedWord];
    return {
      baseForm: item.base,
      explanation: `"${normalizedWord}", "${item.base}" kelimesinin çekimli (${item.type}) biçimidir.`
    };
  }

  // 2. Regular suffix heuristic rules
  // -ies -> -y (e.g. studies -> study, carries -> carry)
  if (normalizedWord.endsWith('ies') && normalizedWord.length > 4) {
    const candidate = normalizedWord.slice(0, -3) + 'y';
    return {
      baseForm: candidate,
      explanation: `"${normalizedWord}", muhtemelen "${candidate}" kelimesinin çoğul veya 3. şahıs halidir.`
    };
  }

  // -ied -> -y (e.g. studied -> study, tried -> try)
  if (normalizedWord.endsWith('ied') && normalizedWord.length > 4) {
    const candidate = normalizedWord.slice(0, -3) + 'y';
    return {
      baseForm: candidate,
      explanation: `"${normalizedWord}", muhtemelen "${candidate}" kelimesinin geçmiş zaman halidir.`
    };
  }

  // -ing (e.g. running -> run, writing -> write, playing -> play)
  if (normalizedWord.endsWith('ing') && normalizedWord.length > 5) {
    const withoutIng = normalizedWord.slice(0, -3);
    // Double consonant: running -> run, swimming -> swim
    if (withoutIng.length >= 3 && withoutIng[withoutIng.length - 1] === withoutIng[withoutIng.length - 2]) {
      const candidate = withoutIng.slice(0, -1);
      return {
        baseForm: candidate,
        explanation: `"${normalizedWord}", "${candidate}" fiilinin -ing biçimidir.`
      };
    }
    // Normal: playing -> play
    return {
      baseForm: withoutIng,
      explanation: `"${normalizedWord}", "${withoutIng}" fiilinin -ing biçimidir.`
    };
  }

  // -ed (e.g. played -> play, looked -> look)
  if (normalizedWord.endsWith('ed') && normalizedWord.length > 4) {
    const withoutEd = normalizedWord.slice(0, -2);
    return {
      baseForm: withoutEd,
      explanation: `"${normalizedWord}", "${withoutEd}" fiilinin geçmiş zaman ekidir.`
    };
  }

  // -es (e.g. watches -> watch, boxes -> box, buzzes -> buzz)
  if ((normalizedWord.endsWith('ches') || normalizedWord.endsWith('shes') || normalizedWord.endsWith('xes') || normalizedWord.endsWith('sses')) && normalizedWord.length > 4) {
    const candidate = normalizedWord.slice(0, -2);
    return {
      baseForm: candidate,
      explanation: `"${normalizedWord}", "${candidate}" kelimesinin -es takılı biçimidir.`
    };
  }

  return null;
}

/**
 * Levenshtein distance for fuzzy matching / typo tolerance
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Checks if user typed answer is acceptable:
 * Allows 1 minor typo if word length is >= 5, 0 typos for shorter words.
 */
export function checkTypedAnswerCorrectness(userAnswer: string, expectedAnswer: string, allowTypoTolerance = true): { isCorrect: boolean; isTypo: boolean } {
  const normUser = normalizeWordString(userAnswer);
  const normExpected = normalizeWordString(expectedAnswer);

  if (normUser === normExpected) {
    return { isCorrect: true, isTypo: false };
  }

  if (allowTypoTolerance && normExpected.length >= 5) {
    const dist = calculateLevenshteinDistance(normUser, normExpected);
    if (dist === 1) {
      return { isCorrect: true, isTypo: true };
    }
  }

  return { isCorrect: false, isTypo: false };
}
