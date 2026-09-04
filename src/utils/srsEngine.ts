/**
 * Spaced Repetition (SRS) Engine
 * Implements modern active recall scheduling, mastery scoring,
 * evidence weighting (typed recall > cloze > flashcard good > multiple choice),
 * and memory health calculation.
 */

import { LearningState, LearningStage, ResponseQuality, WordCard } from '../types';
import { addDaysToStartOfDay, differenceInCalendarDays } from './dateUtils';

/**
 * Standard interval ladder in days:
 * 1 -> 3 -> 7 -> 14 -> 30 -> 60 -> 120 -> 240
 *
 * The ladder is the backbone of scheduling: a successful review advances one
 * rung (two on "easy"), a lapse drops back. Difficulty then stretches or
 * compresses the chosen rung, so a word the learner keeps failing comes back
 * sooner than the nominal interval and an easy word drifts later.
 */
export const INTERVAL_LADDER = [1, 3, 7, 14, 30, 60, 120, 240];

/** Lowest and highest scheduling interval, in days. */
export const MIN_INTERVAL_DAYS = 1;
export const MAX_INTERVAL_DAYS = INTERVAL_LADDER[INTERVAL_LADDER.length - 1];

/**
 * Finds the ladder rung matching an interval, so a state saved by an older
 * build (which used a free-running multiplier) still maps onto the ladder.
 */
export function ladderIndexForInterval(intervalDays: number): number {
  if (intervalDays <= 0) return -1;
  for (let i = INTERVAL_LADDER.length - 1; i >= 0; i--) {
    if (intervalDays >= INTERVAL_LADDER[i]) return i;
  }
  return 0;
}

/**
 * Applies the difficulty modifier to a nominal ladder interval.
 * difficulty 0.0 (easy word) -> x1.15, 0.5 -> x1.0, 1.0 (hard word) -> x0.7.
 */
export function applyDifficultyModifier(intervalDays: number, difficulty: number): number {
  const clamped = Math.min(1, Math.max(0, difficulty));
  const modifier = 1.15 - clamped * 0.45;
  return Math.max(MIN_INTERVAL_DAYS, Math.round(intervalDays * modifier));
}

/**
 * Saklanan bir aralığın hangi basamaktan geldiğini geri çözer.
 *
 * `intervalDays` diske zorluk çarpanı UYGULANDIKTAN sonra yazılıyor; bu yüzden
 * `ladderIndexForInterval` ile kovalanamaz. Eski kod tam bunu yapıyor, sonra
 * seçilen basamağa çarpanı bir kez daha uyguluyordu. difficulty 0,5'in
 * üstündeyken çarpan (1.15 - d*0.45) bir üst basamağı yine alt basamağın
 * kovasına düşürdüğü için tek adımlık ilerleme tamamen geri alınıyordu:
 * zorlanılan bir kelimede kullanıcı arka arkaya sekiz kez doğru bilse bile
 * aralık 2 günde çakılı kalıyor, kelime ekranda "MASTERED / %100" görünürken
 * iki günde bir tekrar karşısına çıkıyordu. Aralığı, aynı zorlukla ölçeklenmiş
 * merdivenle eşleştirmek çarpanı birebir geri alır; böylece başarı gerçekten
 * bir basamak ilerletir ve zorluk yalnızca takvim gününü kaydırır.
 */
export function ladderIndexForStoredInterval(intervalDays: number, difficulty: number): number {
  if (intervalDays <= 0) return -1;
  let bestRung = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < INTERVAL_LADDER.length; i++) {
    const scheduled = Math.min(MAX_INTERVAL_DAYS, applyDifficultyModifier(INTERVAL_LADDER[i], difficulty));
    const distance = Math.abs(scheduled - intervalDays);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRung = i;
    }
  }
  return bestRung;
}

/**
 * Creates initial default learning state for a newly added or unstudied word
 */
export function createInitialLearningState(wordId: string, initialStage: LearningStage = 'NEW'): LearningState {
  const isMasteredInitial = initialStage === 'MASTERED';
  return {
    wordId,
    stage: initialStage,
    masteryScore: isMasteredInitial ? 80 : 0,
    difficulty: 0.3,
    reviewCount: 0,
    correctCount: isMasteredInitial ? 3 : 0,
    wrongCount: 0,
    consecutiveCorrect: isMasteredInitial ? 3 : 0,
    consecutiveWrong: 0,
    intervalDays: isMasteredInitial ? 14 : 0,
    lastReviewedAt: isMasteredInitial ? new Date().toISOString() : undefined,
    // A word the learner marks as already known should not reappear the same
    // day; only genuinely new words are due immediately.
    nextReviewAt: isMasteredInitial
      ? addDaysToStartOfDay(14).toISOString()
      : new Date().toISOString()
  };
}

/**
 * Calculates evidence multiplier based on question mode
 * Typed recall provides strongest evidence of retrieval, multiple choice weakest.
 */
export function getEvidenceWeight(mode: 'flashcard' | 'typed' | 'listening' | 'cloze' | 'quiz'): number {
  switch (mode) {
    case 'typed':
      return 1.4; // Highest cognitive load & retrieval proof
    case 'listening':
      return 1.3;
    case 'cloze':
      return 1.2;
    case 'flashcard':
      return 1.0;
    case 'quiz':
      return 0.7; // Multiple choice can be guessed
    default:
      return 1.0;
  }
}

/**
 * Computes next review state after a study attempt
 */
export function computeNextReviewState(
  currentState: LearningState | undefined,
  wordId: string,
  quality: ResponseQuality,
  mode: 'flashcard' | 'typed' | 'listening' | 'cloze' | 'quiz' = 'flashcard'
): LearningState {
  const state: LearningState = currentState ? { ...currentState } : createInitialLearningState(wordId, 'NEW');
  const now = new Date();
  const weight = getEvidenceWeight(mode);
  // Saklı aralık, bu cevaptan ÖNCEKİ zorlukla ölçeklenmişti; basamağı geri
  // çözerken o değeri kullanmalıyız, yoksa çarpan iki kez uygulanmış olur.
  const previousDifficulty = state.difficulty;

  state.reviewCount += 1;
  state.lastReviewedAt = now.toISOString();
  state.lastResponseQuality = quality;

  const isSuccess = quality === 'good' || quality === 'easy';

  if (isSuccess) {
    state.correctCount += 1;
    state.consecutiveCorrect += 1;
    state.consecutiveWrong = 0;

    // Difficulty adjustment. A successful recall must never make a word look
    // *harder* than before -- the previous build nudged difficulty up by 0.01
    // on every "good" answer, so a word answered correctly fifty times drifted
    // towards maximum difficulty and its intervals stopped growing.
    if (quality === 'easy') {
      state.difficulty = Math.max(0, state.difficulty - 0.08);
    } else {
      state.difficulty = Math.max(0, state.difficulty - 0.02);
    }

    // Interval expansion: advance along the ladder, then let difficulty
    // stretch or compress the rung.
    const currentRung = ladderIndexForStoredInterval(state.intervalDays, previousDifficulty);
    const step = quality === 'easy' ? 2 : 1;
    const nextRung = Math.min(INTERVAL_LADDER.length - 1, currentRung + step);
    state.intervalDays = Math.min(
      MAX_INTERVAL_DAYS,
      applyDifficultyModifier(INTERVAL_LADDER[nextRung], state.difficulty)
    );

    // Mastery Score progression with evidence weighting
    const masteryGain = (quality === 'easy' ? 22 : 14) * weight;
    state.masteryScore = Math.min(100, Math.round(state.masteryScore + masteryGain));

    // Stage progression
    if (state.masteryScore >= 80 && state.consecutiveCorrect >= 3) {
      state.stage = 'MASTERED';
    } else if (state.masteryScore >= 45) {
      state.stage = 'REVIEW';
    } else {
      state.stage = 'LEARNING';
    }

  } else {
    // Failure (Again / Hard / Wrong)
    state.wrongCount += 1;
    state.consecutiveWrong += 1;
    state.consecutiveCorrect = 0;

    // Increase difficulty on failure
    state.difficulty = Math.min(1.0, state.difficulty + (quality === 'again' ? 0.15 : 0.08));

    // Collapse interval
    if (quality === 'again') {
      state.intervalDays = 0; // Immediate review
      state.masteryScore = Math.max(0, Math.round(state.masteryScore - (25 * weight)));
      // If was MASTERED, convert to RELEARNING; otherwise WEAK or LEARNING
      if (state.stage === 'MASTERED') {
        state.stage = 'RELEARNING';
      } else {
        state.stage = state.consecutiveWrong >= 2 ? 'WEAK' : 'LEARNING';
      }
    } else {
      // Hard (partially recalled or struggled): drop one rung rather than
      // scaling the raw interval, so the schedule stays on the ladder.
      const rung = ladderIndexForStoredInterval(state.intervalDays, previousDifficulty);
      const droppedRung = Math.max(0, rung - 1);
      state.intervalDays = applyDifficultyModifier(INTERVAL_LADDER[droppedRung], state.difficulty);
      state.masteryScore = Math.max(0, Math.round(state.masteryScore - (10 * weight)));
      state.stage = state.consecutiveWrong >= 2 ? 'WEAK' : 'REVIEW';
    }
  }

  // Calculate Next Review Date.
  //
  // Multi-day intervals are anchored to the *start* of the target day. Adding
  // days to the current timestamp instead would keep the clock time, so a word
  // studied at 23:00 with a one-day interval would not come due until 23:00 the
  // next evening -- the learner would open the app in the morning and be told
  // there is nothing to review.
  let nextDate: Date;
  if (state.intervalDays === 0) {
    // Re-queue within the same session.
    nextDate = new Date(now);
    nextDate.setMinutes(nextDate.getMinutes() + 10);
  } else {
    nextDate = addDaysToStartOfDay(state.intervalDays, now);
  }
  state.nextReviewAt = nextDate.toISOString();

  return state;
}

/**
 * True when the word has never been studied (or was reset to NEW).
 */
export function isNewWord(state: LearningState | undefined): boolean {
  return !state || state.stage === 'NEW';
}

/**
 * True when a word the learner has already started is due to come back.
 *
 * This deliberately excludes untouched words. `isWordDueForReview` treats an
 * unstudied word as "ready", which is right for a study queue but wrong for a
 * counter: counting it made the dashboard report the entire Oxford dictionary
 * (~3.900 entries) as "due today". Use this for anything the learner reads as
 * a workload figure, and `isWordDueForReview` for building a queue.
 */
export function isReviewDue(state: LearningState | undefined, now: Date = new Date()): boolean {
  if (isNewWord(state)) return false;
  const reviewTime = new Date(state!.nextReviewAt).getTime();
  if (Number.isNaN(reviewTime)) return true; // bozuk tarih -> tekrara al
  return now.getTime() >= reviewTime;
}

/**
 * Checks if a word is currently available to study: either never seen before
 * or past its scheduled review time.
 */
export function isWordDueForReview(state: LearningState | undefined): boolean {
  if (isNewWord(state)) return true; // Unstudied is considered ready
  return isReviewDue(state);
}

/**
 * Splits a set of words into the two counts a learner actually cares about:
 * how many reviews are waiting, and how many new words are still untouched.
 */
export function summarizeQueue(
  wordIds: readonly string[],
  learningStates: Record<string, LearningState>,
  now: Date = new Date()
): { dueCount: number; newCount: number } {
  let dueCount = 0;
  let newCount = 0;
  for (const id of wordIds) {
    const state = learningStates[id];
    if (isNewWord(state)) {
      newCount++;
    } else if (isReviewDue(state, now)) {
      dueCount++;
    }
  }
  return { dueCount, newCount };
}

/**
 * Calculates Memory Health Percentage (0 - 100%)
 * Measures what percentage of learned/review words are current vs overdue.
 */
export function calculateMemoryHealth(
  allWordIds: string[],
  learningStates: Record<string, LearningState>
): number {
  const activeStates = allWordIds
    .map(id => learningStates[id])
    .filter((s): s is LearningState => !!s && s.stage !== 'NEW');

  if (activeStates.length === 0) return 100;

  const now = new Date().getTime();
  let healthyCount = 0;

  activeStates.forEach(s => {
    const dueTime = new Date(s.nextReviewAt).getTime();
    if (Number.isNaN(dueTime)) return; // bozuk kayıt sağlığı etkilemesin
    if (now < dueTime) {
      healthyCount += 1;
      return;
    }
    // Overdue: measured in whole days, matching how intervals are scheduled.
    // A word that came due at 00:00 this morning is not "a day overdue".
    const overdueDays = differenceInCalendarDays(now, dueTime);
    if (overdueDays <= 0) {
      healthyCount += 1;
    } else if (overdueDays <= 1) {
      healthyCount += 0.8; // Minor overdue penalty
    } else if (overdueDays <= 3) {
      healthyCount += 0.4;
    }
  });

  return Math.min(100, Math.max(0, Math.round((healthyCount / activeStates.length) * 100)));
}
