import { describe, it, expect } from 'vitest';
import {
  INTERVAL_LADDER,
  createInitialLearningState,
  computeNextReviewState,
  ladderIndexForInterval,
  isReviewDue,
  isNewWord,
  summarizeQueue,
  calculateMemoryHealth
} from '../srsEngine';
import { LearningState } from '../../types';
import { startOfDay, differenceInCalendarDays } from '../dateUtils';

describe('ladderIndexForInterval', () => {
  it('aralığı merdivendeki basamağa eşler', () => {
    expect(ladderIndexForInterval(0)).toBe(-1);
    expect(ladderIndexForInterval(1)).toBe(0);
    expect(ladderIndexForInterval(3)).toBe(1);
    expect(ladderIndexForInterval(5)).toBe(1); // 3 ile 7 arası -> 3'ün basamağı
    expect(ladderIndexForInterval(1000)).toBe(INTERVAL_LADDER.length - 1);
  });
});

describe('computeNextReviewState', () => {
  it('doğru cevap zorluğu artırmaz', () => {
    // Eski davranış "good" cevapta difficulty += 0.01 yapıyordu; sürekli doğru
    // bilinen bir kelime zamanla en zor kelime gibi ölçeklenip aralıkları
    // kısalıyordu.
    let state = createInitialLearningState('w1');
    const initialDifficulty = state.difficulty;
    state = computeNextReviewState(state, 'w1', 'good');
    expect(state.difficulty).toBeLessThanOrEqual(initialDifficulty);
  });

  it('art arda doğru cevaplarda aralık büyür', () => {
    let state = createInitialLearningState('w1');
    const intervals: number[] = [];
    for (let i = 0; i < 5; i++) {
      state = computeNextReviewState(state, 'w1', 'good');
      intervals.push(state.intervalDays);
    }
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
    }
  });

  it('"again" cevabı kelimeyi aynı oturuma geri koyar', () => {
    let state = createInitialLearningState('w1');
    state = computeNextReviewState(state, 'w1', 'good');
    state = computeNextReviewState(state, 'w1', 'again');
    expect(state.intervalDays).toBe(0);
    expect(new Date(state.nextReviewAt).getTime()).toBeLessThan(Date.now() + 60 * 60 * 1000);
  });

  it('öğrenilmiş kelime unutulunca RELEARNING aşamasına düşer', () => {
    let state = createInitialLearningState('w1', 'MASTERED');
    state.stage = 'MASTERED';
    state = computeNextReviewState(state, 'w1', 'again');
    expect(state.stage).toBe('RELEARNING');
  });

  it('çok günlük tekrar hedef günün başına sabitlenir', () => {
    // Asıl hata: aralık doğrudan o anki zaman damgasına ekleniyordu. Gece
    // 23:00'te çalışılan bir kelime ertesi gün ancak 23:00'te tekrara açılıyor,
    // kullanıcı sabah "bugün tekrar yok" görüyordu.
    const lateNight = new Date();
    lateNight.setHours(23, 30, 0, 0);

    let state = createInitialLearningState('w1');
    state = computeNextReviewState(state, 'w1', 'good', 'flashcard');

    const nextReview = new Date(state.nextReviewAt);
    expect(nextReview.getTime()).toBe(startOfDay(nextReview).getTime());
    expect(differenceInCalendarDays(nextReview, new Date())).toBe(state.intervalDays);
  });

  it('yazarak hatırlama çoktan seçmeliden daha çok ustalık kazandırır', () => {
    const typed = computeNextReviewState(createInitialLearningState('w1'), 'w1', 'good', 'typed');
    const quiz = computeNextReviewState(createInitialLearningState('w1'), 'w1', 'good', 'quiz');
    expect(typed.masteryScore).toBeGreaterThan(quiz.masteryScore);
  });
});

describe('createInitialLearningState', () => {
  it('bilindiği işaretlenen kelime aynı gün tekrara düşmez', () => {
    const state = createInitialLearningState('w1', 'MASTERED');
    expect(new Date(state.nextReviewAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('yeni kelime hemen çalışılabilir', () => {
    const state = createInitialLearningState('w1');
    expect(isNewWord(state)).toBe(true);
  });
});

describe('isReviewDue / summarizeQueue', () => {
  const makeState = (overrides: Partial<LearningState>): LearningState => ({
    ...createInitialLearningState('w'),
    stage: 'REVIEW',
    ...overrides
  });

  it('hiç çalışılmamış kelime "bekleyen tekrar" sayılmaz', () => {
    // Asıl hata: gösterge paneli tüm Oxford sözlüğünü günlük iş yükü olarak
    // sayıyordu, çünkü çalışılmamış kelime de "vadesi gelmiş" kabul ediliyordu.
    expect(isReviewDue(undefined)).toBe(false);
    expect(isReviewDue(makeState({ stage: 'NEW' }))).toBe(false);
  });

  it('vadesi geçmiş kelime tekrara alınır', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(isReviewDue(makeState({ nextReviewAt: past }))).toBe(true);
  });

  it('vadesi gelmemiş kelime tekrara alınmaz', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isReviewDue(makeState({ nextReviewAt: future }))).toBe(false);
  });

  it('bekleyen tekrarları ve yeni kelimeleri ayrı sayar', () => {
    const states: Record<string, LearningState> = {
      due: makeState({ wordId: 'due', nextReviewAt: new Date(Date.now() - 1000).toISOString() }),
      later: makeState({ wordId: 'later', nextReviewAt: new Date(Date.now() + 86400000).toISOString() })
    };
    const summary = summarizeQueue(['due', 'later', 'unseen1', 'unseen2'], states);
    expect(summary).toEqual({ dueCount: 1, newCount: 2 });
  });
});

describe('calculateMemoryHealth', () => {
  it('hiç çalışılmamışsa tam sağlık döner', () => {
    expect(calculateMemoryHealth(['a', 'b'], {})).toBe(100);
  });

  it('bozuk tarihli kayıt sonucu NaN yapmaz', () => {
    const states: Record<string, LearningState> = {
      broken: { ...createInitialLearningState('broken'), stage: 'REVIEW', nextReviewAt: 'gecersiz' }
    };
    const health = calculateMemoryHealth(['broken'], states);
    expect(Number.isNaN(health)).toBe(false);
  });
});
