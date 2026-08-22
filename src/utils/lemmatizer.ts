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

  // "be" fiilinin çekimleri
  is: { base: 'be', type: '3rd person singular of be' },
  am: { base: 'be', type: '1st person singular of be' },
  are: { base: 'be', type: 'present plural of be' },
  was: { base: 'be', type: 'past singular of be' },
  were: { base: 'be', type: 'past plural of be' },
  being: { base: 'be', type: 'present participle of be' },

  // "have" / "do" çekimleri
  has: { base: 'have', type: '3rd person singular of have' },
  had: { base: 'have', type: 'past form of have' },
  having: { base: 'have', type: 'present participle of have' },
  does: { base: 'do', type: '3rd person singular of do' },
  doing: { base: 'do', type: 'present participle of do' },
  done: { base: 'do', type: 'past participle of do' },

  // Veri denetiminde eksik olduğu tespit edilen düzensiz fiiller
  sprang: { base: 'spring', type: 'past form of spring' },
  sprung: { base: 'spring', type: 'past participle of spring' },
  bore: { base: 'bear', type: 'past form of bear' },
  borne: { base: 'bear', type: 'past participle of bear' },
  mistook: { base: 'mistake', type: 'past form of mistake' },
  mistaken: { base: 'mistake', type: 'past participle of mistake' },
  tore: { base: 'tear', type: 'past form of tear' },
  torn: { base: 'tear', type: 'past participle of tear' },
  wound: { base: 'wind', type: 'past form of wind' },
  built: { base: 'build', type: 'past form of build' },
  burnt: { base: 'burn', type: 'past form of burn' },
  bent: { base: 'bend', type: 'past form of bend' },
  bit: { base: 'bite', type: 'past form of bite' },
  bitten: { base: 'bite', type: 'past participle of bite' },
  blew: { base: 'blow', type: 'past form of blow' },
  blown: { base: 'blow', type: 'past participle of blow' },
  broke: { base: 'break', type: 'past form of break' },
  broken: { base: 'break', type: 'past participle of break' },
  cut: { base: 'cut', type: 'past form of cut' },
  dealt: { base: 'deal', type: 'past form of deal' },
  drew: { base: 'draw', type: 'past form of draw' },
  drawn: { base: 'draw', type: 'past participle of draw' },
  fought: { base: 'fight', type: 'past form of fight' },
  fed: { base: 'feed', type: 'past form of feed' },
  froze: { base: 'freeze', type: 'past form of freeze' },
  frozen: { base: 'freeze', type: 'past participle of freeze' },
  hid: { base: 'hide', type: 'past form of hide' },
  hidden: { base: 'hide', type: 'past participle of hide' },
  held: { base: 'hold', type: 'past form of hold' },
  hung: { base: 'hang', type: 'past form of hang' },
  hurt: { base: 'hurt', type: 'past form of hurt' },
  laid: { base: 'lay', type: 'past form of lay' },
  led: { base: 'lead', type: 'past form of lead' },
  lent: { base: 'lend', type: 'past form of lend' },
  lay: { base: 'lie', type: 'past form of lie' },
  lain: { base: 'lie', type: 'past participle of lie' },
  lit: { base: 'light', type: 'past form of light' },
  meant: { base: 'mean', type: 'past form of mean' },
  rode: { base: 'ride', type: 'past form of ride' },
  ridden: { base: 'ride', type: 'past participle of ride' },
  rang: { base: 'ring', type: 'past form of ring' },
  rung: { base: 'ring', type: 'past participle of ring' },
  rose: { base: 'rise', type: 'past form of rise' },
  risen: { base: 'rise', type: 'past participle of rise' },
  shot: { base: 'shoot', type: 'past form of shoot' },
  shone: { base: 'shine', type: 'past form of shine' },
  shook: { base: 'shake', type: 'past form of shake' },
  shaken: { base: 'shake', type: 'past participle of shake' },
  sang: { base: 'sing', type: 'past form of sing' },
  sung: { base: 'sing', type: 'past participle of sing' },
  sank: { base: 'sink', type: 'past form of sink' },
  spent: { base: 'spend', type: 'past form of spend' },
  spread: { base: 'spread', type: 'past form of spread' },
  stole: { base: 'steal', type: 'past form of steal' },
  stolen: { base: 'steal', type: 'past participle of steal' },
  struck: { base: 'strike', type: 'past form of strike' },
  swept: { base: 'sweep', type: 'past form of sweep' },
  threw: { base: 'throw', type: 'past form of throw' },
  thrown: { base: 'throw', type: 'past participle of throw' },
  wept: { base: 'weep', type: 'past form of weep' },

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
 * Bir kelimenin sözlükte var olup olmadığını söyleyen fonksiyon.
 *
 * Lemmatizer sözlüğe doğrudan bağlanmaz (dairesel bağımlılık olurdu); çağıran
 * taraf bu kontrolü enjekte eder. Böylece üretilen taban biçim uydurma bir
 * kelime olduğunda ("beed", "stopp") kabul edilmez.
 */
export type KnownWordCheck = (candidate: string) => boolean;

/** Yaygın İngilizce çekim eklerini çıkarmak için aday üreticiler. */
function regularLemmaCandidates(word: string): { baseForm: string; explanation: string }[] {
  const candidates: { baseForm: string; explanation: string }[] = [];
  const add = (baseForm: string, explanation: string) => {
    if (baseForm && baseForm.length >= 2) candidates.push({ baseForm, explanation });
  };

  // -ies -> -y (studies -> study, carries -> carry)
  if (word.endsWith('ies') && word.length > 4) {
    add(word.slice(0, -3) + 'y', `"${word}", "${word.slice(0, -3)}y" kelimesinin çoğul veya 3. şahıs halidir.`);
  }

  // -ied -> -y (studied -> study, tried -> try)
  if (word.endsWith('ied') && word.length > 4) {
    add(word.slice(0, -3) + 'y', `"${word}", "${word.slice(0, -3)}y" kelimesinin geçmiş zaman halidir.`);
  }

  // -es (watches -> watch, boxes -> box, buzzes -> buzz)
  if (/(ches|shes|xes|sses|zes|ses)$/.test(word) && word.length > 4) {
    add(word.slice(0, -2), `"${word}", "${word.slice(0, -2)}" kelimesinin -es takılı biçimidir.`);
  }

  // Düz -s çoğulu / 3. şahıs (books -> book, runs -> run).
  //
  // Bu kural önceki sürümde hiç yoktu: İngilizcenin EN yaygın çekimi
  // lemmatize edilemiyordu. Metin madencisi "books" ile "book" kelimesini
  // ayrı iki madde sayıyor, tekrar tespiti de eşleştiremiyordu.
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && word.length > 3) {
    add(word.slice(0, -1), `"${word}", "${word.slice(0, -1)}" kelimesinin çoğul veya 3. şahıs halidir.`);
  }

  // -ing (playing -> play, running -> run, writing -> write)
  if (word.endsWith('ing') && word.length > 5) {
    const stem = word.slice(0, -3);
    add(stem, `"${word}", "${stem}" fiilinin -ing biçimidir.`);
    // Ünsüz ikizlenmesi: running -> run
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      add(stem.slice(0, -1), `"${word}", "${stem.slice(0, -1)}" fiilinin -ing biçimidir.`);
    }
    // Düşen "e": writing -> write, making -> make
    add(stem + 'e', `"${word}", "${stem}e" fiilinin -ing biçimidir.`);
  }

  // -ed (played -> play, hoped -> hope, stopped -> stop)
  //
  // Önceki sürüm yalnızca son iki harfi atıyordu; "hoped" -> "hop" ve
  // "stopped" -> "stopp" gibi yanlış tabanlar üretiyordu. -ing kuralındaki
  // ikizlenme ve düşen "e" işlemleri burada da uygulanıyor.
  if (word.endsWith('ed') && word.length > 4) {
    const stem = word.slice(0, -2);
    add(stem, `"${word}", "${stem}" fiilinin geçmiş zaman biçimidir.`);
    add(stem + 'e', `"${word}", "${stem}e" fiilinin geçmiş zaman biçimidir.`);
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      add(stem.slice(0, -1), `"${word}", "${stem.slice(0, -1)}" fiilinin geçmiş zaman biçimidir.`);
    }
  }

  return candidates;
}

/**
 * Bir İngilizce kelimenin taban (sözlük) biçimini bulmaya çalışır.
 *
 * `isKnownWord` verildiğinde yalnızca sözlükte gerçekten bulunan adaylar
 * döner. Verilmediğinde ilk makul aday döner (geriye dönük uyumluluk).
 */
export function findLemmaCandidate(
  normalizedWord: string,
  isKnownWord?: KnownWordCheck
): { baseForm: string; explanation: string } | null {
  if (!normalizedWord) return null;

  // 1. Düzensiz çekim sözlüğü — en güvenilir kaynak.
  //
  // Uzunluk sınırı bu adımdan SONRA uygulanır: "is", "am", "was", "ate",
  // "saw", "ran" gibi düzensiz biçimlerin çoğu üç harften kısadır ve önceki
  // sürümdeki erken dönüş bunların hepsini çözülemez hale getiriyordu.
  const irregular = IRREGULAR_INFLECTIONS[normalizedWord];
  if (irregular) {
    return {
      baseForm: irregular.base,
      explanation: `"${normalizedWord}", "${irregular.base}" kelimesinin çekimli (${irregular.type}) biçimidir.`
    };
  }

  // Düzenli ek kuralları çok kısa kelimelerde güvenilir değil.
  if (normalizedWord.length < 3) return null;

  // 2. Düzenli ek kuralları.
  const candidates = regularLemmaCandidates(normalizedWord);
  if (candidates.length === 0) return null;

  if (isKnownWord) {
    // Sözlükte gerçekten var olan ilk adayı seç; hiçbiri yoksa taban üretme.
    const verified = candidates.find(c => c.baseForm !== normalizedWord && isKnownWord(c.baseForm));
    return verified || null;
  }

  return candidates[0];
}

/**
 * Damerau-Levenshtein (optimal dizi hizalama) mesafesi.
 *
 * Düz Levenshtein'dan farkı, yan yana iki harfin yer değiştirmesini tek
 * işlem saymasıdır. Bu fark yazım toleransı için belirleyici: klavyede en sık
 * yapılan hata harf transpozisyonudur ("lihgt" / "light", "teh" / "the").
 * Düz Levenshtein bunu 2 mesafe sayar, dolayısıyla önceki sürümde en yaygın
 * yazım hatası türü hiç affedilmiyordu.
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  const rows = b.length;
  const cols = a.length;
  if (rows === 0) return cols;
  if (cols === 0) return rows;

  const matrix: number[][] = [];
  for (let i = 0; i <= rows; i++) {
    matrix[i] = new Array(cols + 1).fill(0);
    matrix[i][0] = i;
  }
  for (let j = 0; j <= cols; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= rows; i++) {
    for (let j = 1; j <= cols; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j - 1] + cost, // değiştirme
        matrix[i][j - 1] + 1,        // ekleme
        matrix[i - 1][j] + 1         // silme
      );

      // Yan yana harflerin yer değiştirmesi tek işlemdir.
      if (
        i > 1 &&
        j > 1 &&
        b.charAt(i - 1) === a.charAt(j - 2) &&
        b.charAt(i - 2) === a.charAt(j - 1)
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
      }
    }
  }

  return matrix[rows][cols];
}

/**
 * Kullanıcının yazdığı cevabı değerlendirir.
 *
 * Bir harflik yazım hatası, kelime 5 harf veya daha uzunsa hoş görülür. Ancak
 * `isKnownWord` verildiğinde, yazılan şeyin kendisi sözlükte var olan BAŞKA
 * bir kelimeyse tolerans uygulanmaz.
 *
 * Bu ayrım önemli: önceki sürümde "though" sorulduğunda "thought" yazmak
 * (Levenshtein mesafesi 1) doğru sayılıyordu. Öğrenciye yanlış bilgiyi
 * onaylamak, yazım hatasını affetmekten çok daha zararlıdır.
 */
export function checkTypedAnswerCorrectness(
  userAnswer: string,
  expectedAnswer: string,
  allowTypoTolerance = true,
  isKnownWord?: KnownWordCheck
): { isCorrect: boolean; isTypo: boolean } {
  const normUser = normalizeWordString(userAnswer);
  const normExpected = normalizeWordString(expectedAnswer);

  if (normUser === normExpected) {
    return { isCorrect: true, isTypo: false };
  }

  if (allowTypoTolerance && normExpected.length >= 5 && normUser.length > 0) {
    // Yazılan şey başlı başına geçerli bir kelimeyse bu yazım hatası değil,
    // farklı bir kelimedir.
    if (isKnownWord && isKnownWord(normUser)) {
      return { isCorrect: false, isTypo: false };
    }

    const dist = calculateLevenshteinDistance(normUser, normExpected);
    if (dist === 1) {
      return { isCorrect: true, isTypo: true };
    }
  }

  return { isCorrect: false, isTypo: false };
}
