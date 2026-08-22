import { describe, it, expect } from 'vitest';
import { mineVocabularyFromText } from '../textMiner';
import { WordCard, LearningState } from '../../types';

function makeWord(word: string, level: any = 'A1', meaning = 'anlam'): WordCard {
  return {
    id: `ox-${word}`,
    word,
    level,
    partOfSpeech: 'n.',
    turkishMeaning: meaning,
    examples: []
  } as WordCard;
}

const OXFORD = [
  makeWord('book', 'A1', 'kitap'),
  makeWord('run', 'A1', 'koşmak'),
  makeWord('people', 'A1', 'insanlar'),
  makeWord('work', 'A1', 'çalışmak'),
  makeWord('beautiful', 'A2', 'güzel')
];

const EMPTY_STATES: Record<string, LearningState> = {};

describe('mineVocabularyFromText', () => {
  it('boş metinde boş sonuç döner', () => {
    const result = mineVocabularyFromText('   ', OXFORD, [], EMPTY_STATES);
    expect(result.items).toEqual([]);
    expect(result.totalExtracted).toBe(0);
  });

  it('çekimli biçimleri tek lemma altında toplar', () => {
    // Önceki sürümde "run", "running" ve "ran" üç ayrı madde sayılıyor ve
    // sıklıkları bölünüyordu.
    const text = 'He likes to run. She is running fast. They run every day.';
    const result = mineVocabularyFromText(text, OXFORD, [], EMPTY_STATES);
    const runItem = result.items.find(i => i.lemma === 'run');
    expect(runItem).toBeDefined();
    expect(runItem!.count).toBe(3);
    expect(runItem!.observedForms).toContain('running');
  });

  it('kelimenin geçtiği cümleyi saklar', () => {
    const text = 'The weather is fine. She bought a beautiful painting yesterday.';
    const result = mineVocabularyFromText(text, OXFORD, [], EMPTY_STATES);
    const item = result.items.find(i => i.lemma === 'beautiful');
    expect(item?.contextSentence).toBe('She bought a beautiful painting yesterday.');
  });

  it('gerçek kelimeleri durak listesi diye elemez', () => {
    // "people" ve "work" eski durak listesindeydi; ikisi de Oxford 3000 A1
    // kelimesi ve bir başlangıç öğrencisinin öğrenmesi gerekiyor.
    const result = mineVocabularyFromText(
      'Many people work here every day.',
      OXFORD,
      [],
      EMPTY_STATES
    );
    const lemmas = result.items.map(i => i.lemma);
    expect(lemmas).toContain('people');
    expect(lemmas).toContain('work');
  });

  it('dilbilgisi işlev sözcüklerini eler', () => {
    const result = mineVocabularyFromText(
      'The book was there and they had been reading.',
      OXFORD,
      [],
      EMPTY_STATES
    );
    const lemmas = result.items.map(i => i.lemma);
    expect(lemmas).not.toContain('the');
    expect(lemmas).not.toContain('was');
    expect(lemmas).not.toContain('been');
    expect(lemmas).not.toContain('they');
  });

  it('bilinmeyen kelimeye uydurma seviye atamaz', () => {
    // Eski kural: uzunluk >= 8 ise B2, değilse B1. "beautiful" (9 harf) B2
    // çıkıyordu ama gerçekte A2'dir.
    const result = mineVocabularyFromText(
      'The photosynthesis process is complex.',
      OXFORD,
      [],
      EMPTY_STATES
    );
    const unknown = result.items.find(i => i.lemma === 'photosynthesis');
    expect(unknown).toBeDefined();
    expect(unknown!.status).toBe('NEW');
    expect(unknown!.level).toBeUndefined();
  });

  it('sözlükteki kelimenin seviyesini sözlükten okur', () => {
    const result = mineVocabularyFromText('A beautiful day.', OXFORD, [], EMPTY_STATES);
    expect(result.items.find(i => i.lemma === 'beautiful')?.level).toBe('A2');
  });

  it('öğrenilmiş kelimeleri KNOWN olarak işaretler', () => {
    const states: Record<string, LearningState> = {
      'ox-book': { wordId: 'ox-book', stage: 'MASTERED' } as LearningState
    };
    const result = mineVocabularyFromText('I read a book.', OXFORD, [], states);
    expect(result.items.find(i => i.lemma === 'book')?.status).toBe('KNOWN');
    expect(result.knownCount).toBe(1);
  });

  it('yeni adayları listenin başına koyar', () => {
    const result = mineVocabularyFromText(
      'The zephyr moved the book gently.',
      OXFORD,
      [],
      EMPTY_STATES
    );
    expect(result.items[0].status).toBe('NEW');
  });
});
