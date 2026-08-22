import { describe, it, expect } from 'vitest';
import {
  escapeRegExp,
  blankOutWord,
  buildOptions,
  buildQuestion,
  generateQuiz,
  normalizeTypedAnswer,
  OPTIONS_PER_QUESTION
} from '../quizGenerator';
import { WordCard } from '../../types';

function makeWord(overrides: Partial<WordCard> = {}): WordCard {
  return {
    id: `id-${Math.random().toString(36).slice(2)}`,
    word: 'test',
    level: 'A1',
    partOfSpeech: 'n.',
    turkishMeaning: 'deneme',
    examples: [{ en: 'This is a test sentence.', tr: 'Bu bir deneme cümlesidir.' }],
    ...overrides
  } as WordCard;
}

describe('escapeRegExp', () => {
  it('meta karakterleri kaçırır', () => {
    expect(escapeRegExp('C++')).toBe('C\\+\\+');
    expect(escapeRegExp('(un)clear')).toBe('\\(un\\)clear');
  });
});

describe('blankOutWord', () => {
  it('kelimeyi boşlukla değiştirir', () => {
    expect(blankOutWord('The light is bright.', 'light')).toBe('The _______ is bright.');
  });

  it('yaygın çekimleri de yakalar', () => {
    // Eski kod yalnızca birebir eşleşme arıyordu; "running" cümlesinde "run"
    // bulunamayınca cümle olduğu gibi, cevabı açıkta bırakarak soruluyordu.
    expect(blankOutWord('She is running fast.', 'run')).toBe('She is _______ fast.');
  });

  it('düzenli çekim biçimlerini yakalar', () => {
    expect(blankOutWord('She studies hard.', 'study')).toBe('She _______ hard.');
    expect(blankOutWord('He is making dinner.', 'make')).toBe('He is _______ dinner.');
    expect(blankOutWord('Two books are here.', 'book')).toBe('Two _______ are here.');
  });

  it('kelime cümlede yoksa null döner', () => {
    expect(blankOutWord('Completely unrelated sentence.', 'light')).toBeNull();
  });

  it('düzenli ifade meta karakteri içeren kelimede çökmez', () => {
    // Eski kod burada SyntaxError fırlatıyor ve tüm sınav başlatmayı
    // çökertiyordu.
    expect(() => blankOutWord('I know C++ well.', 'C++')).not.toThrow();
    expect(blankOutWord('I know C++ well.', 'C++')).toBe('I know _______ well.');
  });
});

describe('buildOptions', () => {
  it('doğru cevabı her zaman içerir', () => {
    const target = makeWord({ word: 'light', turkishMeaning: 'ışık' });
    const pool = [target, ...Array.from({ length: 10 }, (_, i) => makeWord({ word: `w${i}` }))];
    const options = buildOptions('light', target, pool, w => w.word);
    expect(options).toContain('light');
  });

  it('doğru cevapla aynı metni çeldirici olarak eklemez', () => {
    // "big" ve "large" gibi eşanlamlılar aynı Türkçe karşılığı taşır; eski kod
    // bunları elemediği için soruda iki özdeş şık ya da iki doğru cevap
    // oluşabiliyordu.
    const target = makeWord({ id: 'a', word: 'big', turkishMeaning: 'büyük' });
    const twin = makeWord({ id: 'b', word: 'large', turkishMeaning: 'büyük' });
    const pool = [target, twin, makeWord({ id: 'c', turkishMeaning: 'küçük' }), makeWord({ id: 'd', turkishMeaning: 'hızlı' })];

    const options = buildOptions('büyük', target, pool, w => w.turkishMeaning);
    expect(options.filter(o => o === 'büyük')).toHaveLength(1);
    expect(new Set(options).size).toBe(options.length);
  });

  it('hedef kelimenin kendisini çeldirici yapmaz', () => {
    const target = makeWord({ id: 'a', word: 'light' });
    const pool = [target, makeWord({ id: 'b', word: 'dark' }), makeWord({ id: 'c', word: 'heavy' }), makeWord({ id: 'd', word: 'soft' })];
    const options = buildOptions('light', target, pool, w => w.word);
    expect(options.filter(o => o === 'light')).toHaveLength(1);
  });

  it('yeterli kelime varsa dört şık üretir', () => {
    const target = makeWord({ id: 'a', word: 'light' });
    const pool = [target, ...Array.from({ length: 20 }, (_, i) => makeWord({ id: `p${i}`, word: `word${i}` }))];
    expect(buildOptions('light', target, pool, w => w.word)).toHaveLength(OPTIONS_PER_QUESTION);
  });

  it('havuz yetersizse uydurma şık üretmez', () => {
    const target = makeWord({ id: 'a', word: 'light' });
    const pool = [target, makeWord({ id: 'b', word: 'dark' })];
    const options = buildOptions('light', target, pool, w => w.word);
    expect(options).toHaveLength(2);
  });

  it('aynı seviye ve türdeki çeldiricileri tercih eder', () => {
    const target = makeWord({ id: 'a', word: 'light', level: 'B2', partOfSpeech: 'n.' });
    const sameLevel = Array.from({ length: 3 }, (_, i) =>
      makeWord({ id: `same${i}`, word: `same${i}`, level: 'B2', partOfSpeech: 'n.' })
    );
    const otherLevel = Array.from({ length: 20 }, (_, i) =>
      makeWord({ id: `other${i}`, word: `other${i}`, level: 'A1', partOfSpeech: 'v.' })
    );
    const options = buildOptions('light', target, [target, ...sameLevel, ...otherLevel], w => w.word);
    const distractors = options.filter(o => o !== 'light');
    expect(distractors.every(d => d.startsWith('same'))).toBe(true);
  });
});

describe('buildQuestion', () => {
  it('kelime örnek cümlede geçmiyorsa boşluk doldurmadan vazgeçer', () => {
    const word = makeWord({
      word: 'light',
      examples: [{ en: 'Nothing matching here.', tr: 'Eşleşme yok.' }]
    });
    const question = buildQuestion(word, 'fill-blank', [word, makeWord(), makeWord(), makeWord()], 'q1');
    expect(question.type).toBe('multiple-choice-tr');
  });

  it('boşluk doldurma sorusunda cevap cümlede görünmez', () => {
    const word = makeWord({ word: 'light', examples: [{ en: 'The light is on.', tr: 'Işık açık.' }] });
    const question = buildQuestion(word, 'fill-blank', [word, makeWord(), makeWord(), makeWord()], 'q1');
    expect(question.questionText).toContain('_______');
    expect(question.questionText.toLowerCase()).not.toContain('the light is on');
  });

  it('yazma sorusu şık üretmez', () => {
    const word = makeWord();
    const question = buildQuestion(word, 'writing', [word], 'q1');
    expect(question.options).toEqual([]);
    expect(question.correctAnswer).toBe(word.word);
  });
});

describe('generateQuiz', () => {
  const pool = Array.from({ length: 30 }, (_, i) =>
    makeWord({ id: `w${i}`, word: `word${i}`, turkishMeaning: `anlam${i}` })
  );

  it('istenen sayıda soru üretir', () => {
    expect(generateQuiz(pool, pool, 'MULTIPLE_CHOICE', 10)).toHaveLength(10);
  });

  it('aynı kelimeyi iki kez sormaz', () => {
    const questions = generateQuiz(pool, pool, 'MIXED', 20);
    expect(new Set(questions.map(q => q.word.id)).size).toBe(questions.length);
  });

  it('havuzdan büyük istek havuz boyutuyla sınırlanır', () => {
    expect(generateQuiz(pool.slice(0, 5), pool, 'MIXED', 50)).toHaveLength(5);
  });

  it('her çoktan seçmeli soru doğru cevabı içerir', () => {
    for (const q of generateQuiz(pool, pool, 'MIXED', 25)) {
      if (q.options.length > 0) {
        expect(q.options).toContain(q.correctAnswer);
      }
    }
  });

  it('doğru cevabın konumu belirli bir şıkta toplanmaz', () => {
    // Bozuk karıştırma burada başarısız olur: doğru cevap ilk şıkta yığılır.
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 400; i++) {
      const [q] = generateQuiz(pool, pool, 'MULTIPLE_CHOICE', 1);
      const index = q.options.indexOf(q.correctAnswer);
      if (index >= 0 && index < 4) counts[index]++;
    }
    const total = counts.reduce((a, b) => a + b, 0);
    for (const count of counts) {
      expect(count / total).toBeGreaterThan(0.15);
    }
  });
});

describe('normalizeTypedAnswer', () => {
  it('büyük/küçük harf ve fazla boşluğu yok sayar', () => {
    expect(normalizeTypedAnswer('  Take   Off ')).toBe('take off');
  });
});
