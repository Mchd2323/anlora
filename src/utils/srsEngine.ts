/**
 * Spaced Repetition (SRS) Engine
 * Implements modern active recall scheduling, mastery scoring,
 * evidence weighting (typed recall > cloze > flashcard good > multiple choice),
 * and memory health calculation.
 */

import { LearningState, LearningStage, ResponseQuality, WordCard } from '../types';

/**
 * Standard interval ladder in days:
 * 1 -> 3 -> 7 -> 14 -> 30 -> 60 -> 120 -> 240
 */
export const INTERVAL_LADDER = [1, 3, 7, 14, 30, 60, 120, 240];

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
    nextReviewAt: new Date().toISOString() // Due now
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

  state.reviewCount += 1;
  state.lastReviewedAt = now.toISOString();
  state.lastResponseQuality = quality;

  const isSuccess = quality === 'good' || quality === 'easy';

  if (isSuccess) {
    state.correctCount += 1;
    state.consecutiveCorrect += 1;
    state.consecutiveWrong = 0;

    // Difficulty adjustment
    if (quality === 'easy') {
      state.difficulty = Math.max(0.1, state.difficulty - 0.05);
    } else {
      state.difficulty = Math.max(0.1, Math.min(1.0, state.difficulty + 0.01));
    }

    // Interval expansion calculation
    if (state.intervalDays === 0) {
      state.intervalDays = quality === 'easy' ? 3 : 1;
    } else {
      const multiplier = quality === 'easy' ? 2.5 : 1.8 * (1.1 - state.difficulty * 0.2);
      state.intervalDays = Math.max(1, Math.round(state.intervalDays * multiplier));
    }

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
      // Hard (partially recalled or struggled)
      state.intervalDays = Math.max(1, Math.round(state.intervalDays * 0.7));
      state.masteryScore = Math.max(0, Math.round(state.masteryScore - (10 * weight)));
      state.stage = state.consecutiveWrong >= 2 ? 'WEAK' : 'REVIEW';
    }
  }

  // Calculate Next Review Date
  const nextDate = new Date(now);
  if (state.intervalDays === 0) {
    // Re-queue today (within same session or in a few hours)
    nextDate.setMinutes(nextDate.getMinutes() + 10);
  } else {
    nextDate.setDate(nextDate.getDate() + state.intervalDays);
  }
  state.nextReviewAt = nextDate.toISOString();

  return state;
}

/**
 * Checks if a word is currently due for review
 */
export function isWordDueForReview(state: LearningState | undefined): boolean {
  if (!state) return true; // Unstudied is considered ready
  if (state.stage === 'NEW') return true;
  const now = new Date().getTime();
  const reviewTime = new Date(state.nextReviewAt).getTime();
  return now >= reviewTime;
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
    if (now < dueTime || s.stage === 'MASTERED') {
      healthyCount += 1;
    } else {
      // Overdue by how much?
      const overdueHours = (now - dueTime) / (1000 * 60 * 60);
      if (overdueHours <= 24) {
        healthyCount += 0.8; // Minor overdue penalty
      } else if (overdueHours <= 72) {
        healthyCount += 0.4;
      }
    }
  });

  return Math.min(100, Math.max(0, Math.round((healthyCount / activeStates.length) * 100)));
}

/**
 * Calculates realistic collection progress percentage based on mastery scores & stages
 */
export function calculateCollectionProgress(
  memberWordIds: string[],
  learningStates: Record<string, LearningState>
): {
  percentage: number;
  total: number;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  weakCount: number;
  masteredCount: number;
  dueCount: number;
} {
  const total = memberWordIds.length;
  if (total === 0) {
    return {
      percentage: 0,
      total: 0,
      newCount: 0,
      learningCount: 0,
      reviewCount: 0,
      weakCount: 0,
      masteredCount: 0,
      dueCount: 0
    };
  }

  let totalScore = 0;
  let newCount = 0;
  let learningCount = 0;
  let reviewCount = 0;
  let weakCount = 0;
  let masteredCount = 0;
  let dueCount = 0;

  memberWordIds.forEach(id => {
    const s = learningStates[id];
    if (!s || s.stage === 'NEW') {
      newCount++;
      dueCount++;
    } else {
      totalScore += s.masteryScore;
      if (isWordDueForReview(s)) {
        dueCount++;
      }
      switch (s.stage) {
        case 'LEARNING':
        case 'RELEARNING':
          learningCount++;
          break;
        case 'REVIEW':
          reviewCount++;
          break;
        case 'WEAK':
          weakCount++;
          break;
        case 'MASTERED':
          masteredCount++;
          break;
      }
    }
  });

  const percentage = Math.min(100, Math.max(0, Math.round(totalScore / total)));

  return {
    percentage,
    total,
    newCount,
    learningCount,
    reviewCount,
    weakCount,
    masteredCount,
    dueCount
  };
}
