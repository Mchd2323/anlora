/**
 * Sınav sorusu üretimi.
 *
 * Bu mantık daha önce `QuizModule` bileşeninin içinde duruyordu ve birkaç
 * gerçek hata barındırıyordu:
 *
 *  1. Karıştırma `sort(() => 0.5 - Math.random())` ile yapılıyordu. Bu
 *     karşılaştırıcı tutarsız olduğu için sonuç düzgün dağılmaz; doğru
 *     cevabın şıklar arasındaki yeri öngörülebilir hale gelir ve öğrenci
 *     kelimeyi değil konumu öğrenir.
 *  2. Çeldiriciler doğru cevaba karşı elenmiyordu. "big" ve "large" gibi aynı
 *     Türkçe karşılığı taşıyan kelimeler aynı soruda iki özdeş şık ya da iki
 *     doğru cevap üretebiliyordu.
 *  3. Boşluk doldurma sorusunda kalıp `new RegExp("\\b" + word + "\\b")` ile
 *     kuruluyordu. Kullanıcının kendi eklediği "C++" ya da "(un)clear" gibi
 *     bir kelime düzenli ifade meta karakteri içerdiğinde sınav başlatma
 *     `SyntaxError` ile çöküyordu.
 *  4. Kelime örnek cümlede çekimli geçtiğinde (run / running) hiçbir şey
 *     boşluğa çevrilmiyor, cümle cevabı açıkça göstererek soruluyordu.
 *  5. Çeldiriciler tüm havuzdan seçildiği için B2 sorusuna A1 şıkları
 *     düşebiliyor ve soru anlamsız derecede kolaylaşıyordu.
 *
 * Mantığı saf fonksiyonlara ayırmak bunları hem düzeltilebilir hem de test
 * edilebilir kılar.
 */

import { WordCard } from '../types';
import { shuffle, sample } from './random';

export type QuizQuestionType =
  | 'multiple-choice-tr'
  | 'multiple-choice-en'
  | 'writing'
  | 'fill-blank'
  | 'listening';

export interface QuizQuestion {
  id: string;
  word: WordCard;
  type: QuizQuestionType;
  questionText: string;
  options: string[];
  correctAnswer: string;
}

export type QuizMode = 'MIXED' | 'MULTIPLE_CHOICE' | 'WRITING' | 'LISTENING';

/** Çoktan seçmeli bir soru için gereken en az kelime sayısı (1 doğru + 3 çeldirici). */
export const MIN_POOL_SIZE = 4;

/** Bir çoktan seçmeli soruda gösterilen toplam şık sayısı. */
export const OPTIONS_PER_QUESTION = 4;

/**
 * Düzenli ifade meta karakterlerini kaçırır.
 * Kullanıcı verisinden kalıp kurulduğunda zorunludur.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cümlede hedef kelimeyi (basit çekimleriyle birlikte) boşlukla değiştirir.
 * Kelime cümlede hiç geçmiyorsa `null` döner — bu durumda boşluk doldurma
 * sorusu üretilemez ve çağıran taraf başka bir soru tipine düşmelidir.
 */
export function blankOutWord(sentence: string, word: string): string | null {
  const trimmed = word.trim();
  if (!trimmed || !sentence) return null;

  for (const pattern of buildInflectionPatterns(trimmed)) {
    if (pattern.test(sentence)) {
      pattern.lastIndex = 0;
      return sentence.replace(pattern, '_______');
    }
  }

  return null;
}

/**
 * Hedef kelimenin cümlede geçebileceği biçimler için kalıplar üretir.
 *
 * İngilizce çekim düzensizdir; burada yalnızca düzenli ve yaygın olanlar
 * karşılanır: çoğul/üçüncü tekil (-s/-es), geçmiş (-ed), sürerlik (-ing),
 * karşılaştırma (-er/-est), son ünsüzün ikizlenmesi (run -> running), sondaki
 * "e"nin düşmesi (make -> making) ve "y" -> "ies/ied" dönüşümü
 * (study -> studies). Amaç sözlük düzeyinde doğruluk değil; cevabın soru
 * cümlesinde açıkta kalmasını önlemek.
 */
function buildInflectionPatterns(word: string): RegExp[] {
  const escaped = escapeRegExp(word);

  // `\b` yalnızca kelime karakteriyle sınır oluşturur. "C++" gibi noktalama
  // ile biten bir kelimede sondaki `\b` hiçbir zaman eşleşmez, bu yüzden sınır
  // çapası yalnızca uç gerçekten kelime karakteriyse eklenir.
  const startsWithWordChar = /^\w/.test(word);
  const endsWithWordChar = /\w$/.test(word);
  const leading = startsWithWordChar ? '\\b' : '(?<!\\w)';
  const trailing = endsWithWordChar ? '\\b' : '(?!\\w)';

  const patterns: RegExp[] = [new RegExp(`${leading}${escaped}${trailing}`, 'gi')];

  if (!endsWithWordChar) return patterns;

  const SUFFIXES = 's|es|ed|d|ing|er|est';
  const lastChar = word.slice(-1);
  const doubled = /[a-z]/i.test(lastChar) ? `(?:${escapeRegExp(lastChar)})?` : '';

  patterns.push(new RegExp(`${leading}${escaped}${doubled}(?:${SUFFIXES})\\b`, 'gi'));

  if (/[^aeiou]y$/i.test(word)) {
    const stem = escapeRegExp(word.slice(0, -1));
    patterns.push(new RegExp(`${leading}${stem}(?:ies|ied|ier|iest)\\b`, 'gi'));
  }

  if (/e$/i.test(word)) {
    const stem = escapeRegExp(word.slice(0, -1));
    patterns.push(new RegExp(`${leading}${stem}(?:ing|ed|es)\\b`, 'gi'));
  }

  return patterns;
}

/**
 * Doğru cevap ile birlikte gösterilecek şıkları üretir.
 *
 * Çeldiriciler doğru cevapla ve birbirleriyle çakışmayacak biçimde seçilir;
 * önce aynı CEFR seviyesi ve aynı sözcük türündeki kelimelerden, yeterli
 * gelmezse tüm havuzdan tamamlanır. Yeterli benzersiz çeldirici bulunamazsa
 * soru daha az şıkla döner (uydurma şık üretmek öğrenciyi yanıltır).
 */
/**
 * Bir şıkkın taşıdığı anlam belirteçleri.
 *
 * NEDEN GEREKLİ. Türkçe anlamlar virgülle birleşik tek bir metin olarak
 * geliyor: "yakalamak, enselemek, kapmak". Şıklar tam dize karşılaştırmasıyla
 * elendiğinde "kapmak, almak" gibi bir çeldirici doğru cevaptan FARKLI bir
 * dize olduğu için listeye giriyordu — oysa içinde doğru cevabın anlamı vardı.
 * Öğrenci onu seçtiğinde bildiği hâlde yanlış sayılıyor, üstelik bu sonuç
 * tekrar aralığına yazıldığı için çalışma planı da bozuluyordu.
 *
 * Belirteç düzeyinde elemek bunu kapatıyor: bir aday, doğru cevabın ya da
 * daha önce eklenmiş bir çeldiricinin herhangi bir anlamını taşıyorsa atlanır.
 * İngilizce yönündeki sorularda (madde başı yansıtılırken) tek belirteç
 * döndüğü için davranış değişmez.
 */
function anlamBelirtecleri(value: string): string[] {
  return value
    .split(/[,;]/)
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
}

export function buildOptions(
  correctAnswer: string,
  target: WordCard,
  pool: readonly WordCard[],
  project: (word: WordCard) => string,
  optionCount: number = OPTIONS_PER_QUESTION
): string[] {
  const used = new Set<string>(anlamBelirtecleri(correctAnswer));
  // Belirteci olmayan (yalnız noktalama) bir doğru cevapta da eleme çalışsın.
  if (used.size === 0) used.add(correctAnswer.trim().toLowerCase());
  const distractors: string[] = [];

  const collectFrom = (candidates: readonly WordCard[]) => {
    for (const candidate of candidates) {
      if (distractors.length >= optionCount - 1) return;
      if (candidate.id === target.id) continue;
      const value = (project(candidate) || '').trim();
      if (!value) continue;
      const belirtecler = anlamBelirtecleri(value);
      if (belirtecler.length === 0) continue;
      if (belirtecler.some(t => used.has(t))) continue;
      belirtecler.forEach(t => used.add(t));
      distractors.push(value);
    }
  };

  const others = pool.filter(w => w.id !== target.id);

  // 1. tur: aynı seviye + aynı sözcük türü -> en öğretici çeldiriciler.
  collectFrom(
    shuffle(
      others.filter(w => w.level === target.level && w.partOfSpeech === target.partOfSpeech)
    )
  );
  // 2. tur: aynı seviye.
  collectFrom(shuffle(others.filter(w => w.level === target.level)));
  // 3. tur: kalan her şey.
  collectFrom(shuffle(others));

  return shuffle([correctAnswer, ...distractors]);
}

/** Karışık modda kullanılacak soru tipleri. */
const MIXED_TYPES: QuizQuestionType[] = [
  'multiple-choice-tr',
  'multiple-choice-en',
  'writing',
  'fill-blank',
  'listening'
];

function resolveQuestionType(mode: QuizMode): QuizQuestionType {
  switch (mode) {
    case 'WRITING':
      return 'writing';
    case 'LISTENING':
      return 'listening';
    case 'MULTIPLE_CHOICE':
      return Math.random() > 0.5 ? 'multiple-choice-tr' : 'multiple-choice-en';
    default:
      return MIXED_TYPES[Math.floor(Math.random() * MIXED_TYPES.length)];
  }
}

/**
 * Tek bir kelime için soru üretir.
 * `distractorPool` çeldiricilerin seçileceği havuzdur (genelde tüm kelimeler).
 */
export function buildQuestion(
  word: WordCard,
  requestedType: QuizQuestionType,
  distractorPool: readonly WordCard[],
  id: string
): QuizQuestion {
  let type = requestedType;

  // Boşluk doldurma yalnızca kelimenin gerçekten geçtiği bir örnek cümle
  // varsa üretilebilir; aksi halde cevabı açıkta bırakırdı.
  let blankSentence: string | null = null;
  if (type === 'fill-blank') {
    const examples = Array.isArray(word.examples) ? word.examples : [];
    for (const example of examples) {
      const candidate = blankOutWord(example?.en || '', word.word);
      if (candidate) {
        blankSentence = candidate;
        break;
      }
    }
    if (!blankSentence) {
      type = 'multiple-choice-tr';
    }
  }

  switch (type) {
    case 'multiple-choice-en': {
      const correctAnswer = word.word;
      return {
        id,
        word,
        type,
        questionText: `"${word.turkishMeaning}" anlamına gelen İngilizce kelime hangisidir?`,
        correctAnswer,
        options: buildOptions(correctAnswer, word, distractorPool, w => w.word)
      };
    }
    case 'writing': {
      return {
        id,
        word,
        type,
        questionText: `"${word.turkishMeaning}" anlamına gelen İngilizce kelimeyi yazın:`,
        correctAnswer: word.word,
        options: []
      };
    }
    case 'fill-blank': {
      const correctAnswer = word.word;
      return {
        id,
        word,
        type,
        questionText: `Cümledeki boşluğu doldurun:\n"${blankSentence}"`,
        correctAnswer,
        options: buildOptions(correctAnswer, word, distractorPool, w => w.word)
      };
    }
    case 'listening': {
      const correctAnswer = word.word;
      return {
        id,
        word,
        type,
        questionText: 'Sesli okunan İngilizce kelimeyi seçin:',
        correctAnswer,
        options: buildOptions(correctAnswer, word, distractorPool, w => w.word)
      };
    }
    case 'multiple-choice-tr':
    default: {
      const correctAnswer = word.turkishMeaning;
      return {
        id,
        word,
        type: 'multiple-choice-tr',
        questionText: `"${word.word}" kelimesinin Türkçe anlamı nedir?`,
        correctAnswer,
        options: buildOptions(correctAnswer, word, distractorPool, w => w.turkishMeaning)
      };
    }
  }
}

/**
 * Bir sınav oturumu için soru listesi üretir.
 */
export function generateQuiz(
  pool: readonly WordCard[],
  distractorPool: readonly WordCard[],
  mode: QuizMode,
  questionCount: number
): QuizQuestion[] {
  const selected = sample(pool, Math.min(questionCount, pool.length));
  return selected.map((word, index) =>
    buildQuestion(word, resolveQuestionType(mode), distractorPool, `q-${index}-${word.id}`)
  );
}

/**
 * Yazarak cevaplama için karşılaştırma. Büyük/küçük harf, baştaki-sondaki
 * boşluk ve çoklu boşluk farkları göz ardı edilir.
 */
export function normalizeTypedAnswer(value: string): string {
  /*
   * Birleşen üstteki nokta (U+0307) atılıyor.
   *
   * Türkçe klavyede yazılan 'İt' küçültüldüğünde 'i' + U+0307 + 't' oluyor;
   * bu dizi 'it' ile eşit değil, yani doğru cevap yanlış sayılıyordu. Android
   * klavyesi cümle başındaki harfi kendiliğinden büyüttüğü için i ile başlayan
   * her kelimede oluyordu. Sonuç yalnızca puanı değil, tekrar aralığını da
   * bozuyordu: bilinen kelime "bilinmiyor" diye yeniden planlanıyordu.
   */
  return value.trim().toLowerCase().replace(/\u0307/g, '').replace(/\s+/g, ' ');
}
