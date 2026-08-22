import IRREGULAR_INFLECTIONS_DATA from '../data/irregularInflections.json';

/**
 * Lemmatization, Inflection Normalization & Levenshtein utilities
 * Helps identify base forms (went -> go, studies -> study, children -> child)
 * and normalize apostrophes, punctuation, and casing.
 */

/**
 * İngilizce düzensiz çekim biçimleri: went -> go, children -> child.
 *
 * Liste `src/data/irregularInflections.json` dosyasında tutulur ve hem
 * uygulama hem de `scripts/oxford/*` doğrulama betikleri aynı dosyayı okur.
 * İki ayrı kopya tutmak, listelerin zamanla birbirinden kayması demektir;
 * bu projede rozet sisteminde tam olarak bu olmuştu.
 */
export const IRREGULAR_INFLECTIONS: Record<string, { base: string; type: string }> =
  IRREGULAR_INFLECTIONS_DATA;

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
    // Taban biçim sözlükte yoksa ama kelimenin kendisi varsa, çekimi
    // uygulamak eşleşmeyi kaybettirir. Örnek: "people" -> "person"
    // dilbilgisel olarak doğru, ama sözlükte madde başı "people" ise
    // "person"a çevirmek kelimeyi bulunamaz hale getirir.
    if (isKnownWord && !isKnownWord(irregular.base) && isKnownWord(normalizedWord)) {
      return null;
    }
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
