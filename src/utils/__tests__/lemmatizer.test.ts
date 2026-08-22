import { describe, it, expect } from 'vitest';
import {
  findLemmaCandidate,
  checkTypedAnswerCorrectness,
  normalizeWordString,
  IRREGULAR_INFLECTIONS
} from '../lemmatizer';

// Küçük bir sözlük taklidi: gerçek uygulamada oxfordRepository.isKnownWord.
const DICTIONARY = new Set([
  'book', 'run', 'study', 'write', 'make', 'hope', 'stop', 'play', 'watch',
  'though', 'thought', 'become', 'spring', 'bear', 'tear', 'wind', 'be'
]);
const isKnownWord = (w: string) => DICTIONARY.has(w.toLowerCase());

describe('findLemmaCandidate', () => {
  it('düz -s çoğulunu çözer', () => {
    // Bu kural önceki sürümde hiç yoktu; İngilizcenin en yaygın çekimi
    // lemmatize edilemiyordu.
    expect(findLemmaCandidate('books', isKnownWord)?.baseForm).toBe('book');
    expect(findLemmaCandidate('runs', isKnownWord)?.baseForm).toBe('run');
  });

  it('-ies ve -ied çekimlerini çözer', () => {
    expect(findLemmaCandidate('studies', isKnownWord)?.baseForm).toBe('study');
    expect(findLemmaCandidate('studied', isKnownWord)?.baseForm).toBe('study');
  });

  it('düşen "e" ile biten fiilleri doğru çözer', () => {
    // Eski kural "hoped" -> "hop" üretiyordu.
    expect(findLemmaCandidate('hoped', isKnownWord)?.baseForm).toBe('hope');
    expect(findLemmaCandidate('writing', isKnownWord)?.baseForm).toBe('write');
    expect(findLemmaCandidate('making', isKnownWord)?.baseForm).toBe('make');
  });

  it('ünsüz ikizlenmesini çözer', () => {
    // Eski kural "stopped" -> "stopp" üretiyordu.
    expect(findLemmaCandidate('stopped', isKnownWord)?.baseForm).toBe('stop');
    expect(findLemmaCandidate('running', isKnownWord)?.baseForm).toBe('run');
  });

  it('düzensiz çekimleri sözlükten çözer', () => {
    expect(findLemmaCandidate('became')?.baseForm).toBe('become');
    expect(findLemmaCandidate('sprang')?.baseForm).toBe('spring');
    expect(findLemmaCandidate('mistook')?.baseForm).toBe('mistake');
    expect(findLemmaCandidate('tore')?.baseForm).toBe('tear');
    expect(findLemmaCandidate('is')?.baseForm).toBe('be');
  });

  it('sözlük verildiğinde var olmayan taban üretmez', () => {
    // "beed" hiçbir gerçek kelimeye çözülmez; uydurma taban dönmemeli.
    expect(findLemmaCandidate('beed', isKnownWord)).toBeNull();
    expect(findLemmaCandidate('xyzzies', isKnownWord)).toBeNull();
  });

  it('çok kısa kelimeleri işlemez', () => {
    expect(findLemmaCandidate('go')).toBeNull();
  });

  it('düzensiz çekim sözlüğü tutarlıdır', () => {
    for (const [form, info] of Object.entries(IRREGULAR_INFLECTIONS)) {
      expect(form).toBe(form.toLowerCase());
      expect(info.base.length).toBeGreaterThan(0);
      expect(info.type.length).toBeGreaterThan(0);
    }
  });
});

describe('checkTypedAnswerCorrectness', () => {
  it('birebir doğru cevabı kabul eder', () => {
    expect(checkTypedAnswerCorrectness('light', 'light')).toEqual({ isCorrect: true, isTypo: false });
  });

  it('büyük/küçük harf ve boşluk farkını yok sayar', () => {
    expect(checkTypedAnswerCorrectness('  Light ', 'light').isCorrect).toBe(true);
  });

  it('uzun kelimede bir harflik yazım hatasını affeder', () => {
    const result = checkTypedAnswerCorrectness('lihgt', 'light');
    expect(result.isCorrect).toBe(true);
    expect(result.isTypo).toBe(true);
  });

  it('kısa kelimede tolerans uygulamaz', () => {
    expect(checkTypedAnswerCorrectness('cet', 'cat').isCorrect).toBe(false);
  });

  it('başka bir gerçek kelimeyi doğru saymaz', () => {
    // Asıl hata: "though" sorulduğunda "thought" (mesafe 1) doğru sayılıyordu.
    expect(checkTypedAnswerCorrectness('thought', 'though', true, isKnownWord).isCorrect).toBe(false);
  });

  it('sözlük verilmediğinde eski davranışı korur', () => {
    expect(checkTypedAnswerCorrectness('thought', 'though').isCorrect).toBe(true);
  });

  it('tolerans kapatıldığında yazım hatasını kabul etmez', () => {
    expect(checkTypedAnswerCorrectness('lihgt', 'light', false).isCorrect).toBe(false);
  });

  it('boş cevabı doğru saymaz', () => {
    expect(checkTypedAnswerCorrectness('', 'light').isCorrect).toBe(false);
  });
});

describe('normalizeWordString', () => {
  it('kıvrık tırnakları düzleştirir', () => {
    expect(normalizeWordString('don’t')).toBe("don't");
  });

  it('baştaki ve sondaki noktalamayı atar', () => {
    expect(normalizeWordString('  "Light!"  ')).toBe('light');
  });
});
