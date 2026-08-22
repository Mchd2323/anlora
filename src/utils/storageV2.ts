/**
 * Version 2 Local-First Storage & Data Migration Architecture
 * Manages Collections, Memberships, Word Entities, Learning States (SRS),
 * Review Logs, Confusion Pairs, User Settings, and Backup/Export.
 */

import {
  WordCard,
  Collection,
  CollectionMembership,
  LearningState,
  ReviewEvent,
  ConfusionPair,
  UserSettings,
  UserStats,
  UserProfile,
  V2BackupPayload
} from '../types';
import { BADGES_DATA, OXFORD_3000_WORDS } from '../data/oxfordWords';
import { createInitialLearningState, computeNextReviewState } from './srsEngine';
import { normalizeWordString } from './lemmatizer';

export const V2_KEYS = {
  MIGRATION_COMPLETED: 'lexiflow_v2_migration_done',
  COLLECTIONS: 'lexiflow_v2_collections',
  MEMBERSHIPS: 'lexiflow_v2_memberships',
  CUSTOM_WORDS: 'lexiflow_v2_custom_words',
  LEARNING_STATES: 'lexiflow_v2_learning_states',
  REVIEW_HISTORY: 'lexiflow_v2_review_history',
  CONFUSION_PAIRS: 'lexiflow_v2_confusion_pairs',
  SETTINGS: 'lexiflow_v2_settings',
  FAVORITES: 'lexiflow_v2_favorites',
  STATS: 'lexiflow_v2_stats',
  BADGES: 'lexiflow_v2_badges',
  PROFILE: 'lexiflow_v2_profile'
};

const V1_KEYS = {
  FAVORITES: 'oxford_3000_favorites_v1',
  LEARNED: 'oxford_3000_learned_v1',
  CUSTOM_CARDS: 'oxford_3000_custom_cards_v1',
  STATS: 'oxford_3000_user_stats_v1',
  UNLOCKED_BADGES: 'oxford_3000_unlocked_badges_v1',
  PROFILE: 'oxford_3000_user_profile_v1'
};

const DEFAULT_SETTINGS: UserSettings = {
  dailyReviewGoal: 15,
  dailyNewWordsGoal: 5,
  autoPlayAudioOnCard: false,
  preferredStudyMode: 'mixed',
  enableTypoTolerance: true
};

const MAX_REVIEW_LOGS_RETENTION = 500;

/**
 * Migration Runner: Runs once if V2 data is not initialized
 */
export function runV1toV2MigrationIfNeeded(oxfordWordsList: WordCard[] = []): void {
  try {
    const isMigrated = localStorage.getItem(V2_KEYS.MIGRATION_COMPLETED);
    if (isMigrated === 'true') {
      return;
    }

    // 1. Read existing V1 data safely
    let v1CustomCards: WordCard[] = [];
    let v1Learned: string[] = [];
    let v1Favorites: string[] = [];
    let v1Stats: any = null;
    let v1Badges: string[] = ['first_step'];
    let v1Profile: any = { email: null, isLoggedIn: false };

    try {
      const c = localStorage.getItem(V1_KEYS.CUSTOM_CARDS);
      if (c) v1CustomCards = JSON.parse(c);
    } catch {}

    try {
      const l = localStorage.getItem(V1_KEYS.LEARNED);
      if (l) v1Learned = JSON.parse(l);
    } catch {}

    try {
      const f = localStorage.getItem(V1_KEYS.FAVORITES);
      if (f) v1Favorites = JSON.parse(f);
    } catch {}

    try {
      const s = localStorage.getItem(V1_KEYS.STATS);
      if (s) v1Stats = JSON.parse(s);
    } catch {}

    try {
      const b = localStorage.getItem(V1_KEYS.UNLOCKED_BADGES);
      if (b) v1Badges = JSON.parse(b);
    } catch {}

    try {
      const p = localStorage.getItem(V1_KEYS.PROFILE);
      if (p) v1Profile = JSON.parse(p);
    } catch {}

    const nowIso = new Date().toISOString();

    // 2. Create Initial Collections
    const collections: Collection[] = [];
    const memberships: CollectionMembership[] = [];

    // Always create the legacy notebook collection
    const legacyDeckId = 'deck-legacy-notebook';
    collections.push({
      id: legacyDeckId,
      name: 'Eski Özel Defterim',
      description: 'Version 1 özel kelime kartlarınız ve notlarınız',
      iconName: 'BookOpen',
      color: 'amber',
      isPinned: true,
      isArchived: false,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    // Sample Starter Collection for new users
    if (v1CustomCards.length === 0) {
      collections.push({
        id: 'deck-breaking-bad',
        name: 'Dizi & Film Alıntıları',
        description: 'Dizilerden alıntılanmış bağlam cümleli kelimeler',
        iconName: 'Tv',
        color: 'indigo',
        isPinned: false,
        isArchived: false,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }

    // 3. Migrate Custom Words & Memberships
    const customWords: WordCard[] = [];
    const learningStates: Record<string, LearningState> = {};

    v1CustomCards.forEach(card => {
      customWords.push({
        ...card,
        isCustom: true,
        canonicalWord: normalizeWordString(card.word),
        dateAdded: card.dateAdded || nowIso.slice(0, 10)
      });

      // Link to "Eski Özel Defterim"
      memberships.push({
        id: `mem-${card.id}-${legacyDeckId}`,
        wordId: card.id,
        collectionId: legacyDeckId,
        sourceName: card.customNote || 'Özel Not',
        sourceContext: card.examples && card.examples[0] ? card.examples[0].en : undefined,
        addedAt: nowIso
      });

      // Set learning state
      const isLearned = v1Learned.includes(card.id);
      learningStates[card.id] = createInitialLearningState(
        card.id,
        isLearned ? 'REVIEW' : 'NEW'
      );
    });

    // 4. Migrate Oxford learned words to global learning states
    v1Learned.forEach(wordId => {
      if (!learningStates[wordId]) {
        learningStates[wordId] = createInitialLearningState(wordId, 'REVIEW');
      }
    });

    // 5. Save everything to V2 storage
    localStorage.setItem(V2_KEYS.COLLECTIONS, JSON.stringify(collections));
    localStorage.setItem(V2_KEYS.MEMBERSHIPS, JSON.stringify(memberships));
    localStorage.setItem(V2_KEYS.CUSTOM_WORDS, JSON.stringify(customWords));
    localStorage.setItem(V2_KEYS.LEARNING_STATES, JSON.stringify(learningStates));
    localStorage.setItem(V2_KEYS.REVIEW_HISTORY, JSON.stringify([]));
    localStorage.setItem(V2_KEYS.CONFUSION_PAIRS, JSON.stringify([]));
    localStorage.setItem(V2_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem(V2_KEYS.FAVORITES, JSON.stringify(v1Favorites));

    const finalStats: UserStats = v1Stats || {
      totalQuizzesTaken: 0,
      totalCorrect: 0,
      totalWrong: 0,
      streakDays: 1,
      lastActiveDate: nowIso,
      mistakesMap: {},
      learnedCount: v1Learned.length,
      favoriteCount: v1Favorites.length,
      customCardsCount: customWords.length
    };
    localStorage.setItem(V2_KEYS.STATS, JSON.stringify(finalStats));
    localStorage.setItem(V2_KEYS.BADGES, JSON.stringify(v1Badges));
    localStorage.setItem(V2_KEYS.PROFILE, JSON.stringify(v1Profile));

    localStorage.setItem(V2_KEYS.MIGRATION_COMPLETED, 'true');
    console.log('✅ Version 2 Migration successfully completed.');
  } catch (err) {
    console.error('Migration error:', err);
  }
}

// ----------------------------------------------------
// COLLECTIONS
// ----------------------------------------------------
export function getCollections(): Collection[] {
  try {
    const d = localStorage.getItem(V2_KEYS.COLLECTIONS);
    return d ? JSON.parse(d) : [];
  } catch {
    return [];
  }
}

export function saveCollections(collections: Collection[]): void {
  localStorage.setItem(V2_KEYS.COLLECTIONS, JSON.stringify(collections));
}

export function addCollection(deck: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>): Collection {
  const collections = getCollections();
  const now = new Date().toISOString();
  const newDeck: Collection = {
    ...deck,
    id: `deck-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now,
    updatedAt: now
  };
  const updated = [newDeck, ...collections];
  saveCollections(updated);
  return newDeck;
}

export function createCollectionV2(
  name: string,
  description?: string,
  color?: string,
  iconName?: string
): Collection {
  return addCollection({
    name,
    description,
    color,
    iconName,
    isPinned: false,
    isArchived: false
  });
}

export function updateCollection(updatedDeck: Collection): Collection[] {
  const collections = getCollections();
  const updated = collections.map(c =>
    c.id === updatedDeck.id ? { ...updatedDeck, updatedAt: new Date().toISOString() } : c
  );
  saveCollections(updated);
  return updated;
}

export function deleteCollection(collectionId: string): Collection[] {
  const collections = getCollections();
  const updated = collections.filter(c => c.id !== collectionId);
  saveCollections(updated);

  // Remove memberships for this collection
  const memberships = getMemberships();
  const updatedMemberships = memberships.filter(m => m.collectionId !== collectionId);
  saveMemberships(updatedMemberships);

  return updated;
}

// ----------------------------------------------------
// MEMBERSHIPS (Word <-> Collection Link)
// ----------------------------------------------------
export function getMemberships(): CollectionMembership[] {
  try {
    const d = localStorage.getItem(V2_KEYS.MEMBERSHIPS);
    return d ? JSON.parse(d) : [];
  } catch {
    return [];
  }
}

export function saveMemberships(memberships: CollectionMembership[]): void {
  localStorage.setItem(V2_KEYS.MEMBERSHIPS, JSON.stringify(memberships));
}

export function addWordToCollection(
  wordId: string,
  collectionId: string,
  sourceContext?: string,
  sourceName?: string
): CollectionMembership[] {
  const memberships = getMemberships();
  const existing = memberships.find(m => m.wordId === wordId && m.collectionId === collectionId);
  if (existing) {
    if (sourceContext || sourceName) {
      existing.sourceContext = sourceContext || existing.sourceContext;
      existing.sourceName = sourceName || existing.sourceName;
      saveMemberships(memberships);
    }
    return memberships;
  }

  const newMem: CollectionMembership = {
    id: `mem-${wordId}-${collectionId}-${Date.now()}`,
    wordId,
    collectionId,
    sourceContext,
    sourceName,
    addedAt: new Date().toISOString()
  };

  const updated = [...memberships, newMem];
  saveMemberships(updated);
  return updated;
}

export function removeWordFromCollection(wordId: string, collectionId: string): CollectionMembership[] {
  const memberships = getMemberships();
  const updated = memberships.filter(m => !(m.wordId === wordId && m.collectionId === collectionId));
  saveMemberships(updated);
  return updated;
}

export function getWordMemberships(wordId: string): CollectionMembership[] {
  const memberships = getMemberships();
  return memberships.filter(m => m.wordId === wordId);
}

// ----------------------------------------------------
// CUSTOM WORDS (Word Entities)
// ----------------------------------------------------
export function getCustomWords(): WordCard[] {
  try {
    const d = localStorage.getItem(V2_KEYS.CUSTOM_WORDS);
    return d ? JSON.parse(d) : [];
  } catch {
    return [];
  }
}

export function saveCustomWords(words: WordCard[]): void {
  localStorage.setItem(V2_KEYS.CUSTOM_WORDS, JSON.stringify(words));
}

export function addCustomWord(
  card: WordCard,
  targetCollectionId?: string,
  sourceContext?: string,
  sourceName?: string
): { updatedWords: WordCard[]; card: WordCard } {
  const words = getCustomWords();
  const normalized = normalizeWordString(card.word);
  const cardWithCanonical: WordCard = {
    ...card,
    canonicalWord: normalized,
    dateAdded: card.dateAdded || new Date().toISOString().slice(0, 10)
  };

  const updatedWords = [cardWithCanonical, ...words.filter(w => w.id !== card.id)];
  saveCustomWords(updatedWords);

  // Initialize learning state if not existing
  const states = getLearningStates();
  if (!states[card.id]) {
    states[card.id] = createInitialLearningState(card.id, 'NEW');
    saveLearningStates(states);
  }

  // Link to target collection if provided
  if (targetCollectionId) {
    addWordToCollection(card.id, targetCollectionId, sourceContext, sourceName);
  }

  return { updatedWords, card: cardWithCanonical };
}

export function updateCustomWord(updatedCard: WordCard): WordCard[] {
  const words = getCustomWords();
  const updated = words.map(w => (w.id === updatedCard.id ? { ...updatedCard, canonicalWord: normalizeWordString(updatedCard.word) } : w));
  saveCustomWords(updated);
  return updated;
}

export function permanentlyDeleteWord(wordId: string): WordCard[] {
  const words = getCustomWords();
  const updated = words.filter(w => w.id !== wordId);
  saveCustomWords(updated);

  // Remove all memberships
  const memberships = getMemberships();
  saveMemberships(memberships.filter(m => m.wordId !== wordId));

  // Remove from favorites
  const favorites = getFavorites();
  saveFavorites(favorites.filter(id => id !== wordId));

  return updated;
}

// ----------------------------------------------------
// LEARNING STATES (SRS)
// ----------------------------------------------------
export function getLearningStates(): Record<string, LearningState> {
  try {
    const d = localStorage.getItem(V2_KEYS.LEARNING_STATES);
    return d ? JSON.parse(d) : {};
  } catch {
    return {};
  }
}

export function saveLearningStates(states: Record<string, LearningState>): void {
  localStorage.setItem(V2_KEYS.LEARNING_STATES, JSON.stringify(states));
}

export function getUserWordStatus(
  wordId: string,
  states?: Record<string, LearningState>
): 'learned' | 'learning' | 'unseen' {
  const allStates = states || getLearningStates();
  const state = allStates[wordId];
  if (!state) return 'unseen';
  if (state.userStatus) return state.userStatus;
  if (state.stage === 'MASTERED') return 'learned';
  if (
    state.stage === 'LEARNING' ||
    state.stage === 'RELEARNING' ||
    state.stage === 'WEAK' ||
    state.stage === 'REVIEW'
  ) {
    return 'learning';
  }
  return 'unseen';
}

export function setUserWordStatus(
  wordId: string,
  status: 'learned' | 'learning' | 'unseen',
  customCollectionId?: string
): Record<string, LearningState> {
  const states = getLearningStates();
  let state = states[wordId];

  if (!state) {
    state = createInitialLearningState(
      wordId,
      status === 'learned' ? 'MASTERED' : status === 'learning' ? 'LEARNING' : 'NEW'
    );
  }

  if (status === 'learned') {
    state.userStatus = 'learned';
    state.stage = 'MASTERED';
    state.masteryScore = Math.max(state.masteryScore || 0, 85);
    state.lastReviewedAt = new Date().toISOString();
  } else if (status === 'learning') {
    state.userStatus = 'learning';
    state.stage = 'LEARNING';
    state.difficulty = Math.max(state.difficulty || 0.3, 0.4);
    // Mark for immediate / prioritized review
    state.nextReviewAt = new Date().toISOString();
    state.lastReviewedAt = new Date().toISOString();
  } else {
    state.userStatus = 'unseen';
    state.stage = 'NEW';
    state.masteryScore = 0;
  }

  states[wordId] = state;
  saveLearningStates(states);

  // Also record review log for progress tracking
  if (status !== 'unseen') {
    addReviewEvent({
      id: `rev-status-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      wordId,
      collectionId: customCollectionId,
      timestamp: new Date().toISOString(),
      quality: status === 'learned' ? 'easy' : 'again',
      mode: 'flashcard',
      isCorrect: status === 'learned'
    });
  }

  return states;
}

export function recordStudyResult(
  wordId: string,
  quality: 'again' | 'hard' | 'good' | 'easy',
  mode: 'flashcard' | 'typed' | 'listening' | 'cloze' | 'quiz' = 'flashcard',
  collectionId?: string
): LearningState {
  const states = getLearningStates();
  const currentState = states[wordId];
  const nextState = computeNextReviewState(currentState, wordId, quality, mode);
  states[wordId] = nextState;
  saveLearningStates(states);

  const isCorrect = quality === 'good' || quality === 'easy';
  addReviewEvent({
    id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    wordId,
    collectionId,
    timestamp: new Date().toISOString(),
    quality,
    mode,
    isCorrect
  });

  return nextState;
}

// ----------------------------------------------------
// REVIEW HISTORY
// ----------------------------------------------------
export function getReviewHistory(): ReviewEvent[] {
  try {
    const d = localStorage.getItem(V2_KEYS.REVIEW_HISTORY);
    return d ? JSON.parse(d) : [];
  } catch {
    return [];
  }
}

export function addReviewEvent(event: ReviewEvent): void {
  try {
    const history = getReviewHistory();
    const updated = [event, ...history.slice(0, MAX_REVIEW_LOGS_RETENTION - 1)];
    localStorage.setItem(V2_KEYS.REVIEW_HISTORY, JSON.stringify(updated));
  } catch {}
}

// ----------------------------------------------------
// CONFUSION PAIRS
// ----------------------------------------------------
export function getConfusionPairs(): ConfusionPair[] {
  try {
    const d = localStorage.getItem(V2_KEYS.CONFUSION_PAIRS);
    return d ? JSON.parse(d) : [];
  } catch {
    return [];
  }
}

export function recordConfusionPair(
  wordAId: string,
  wordBId: string,
  wordA: string,
  wordB: string
): ConfusionPair[] {
  const pairs = getConfusionPairs();
  const pairId = [wordAId, wordBId].sort().join('_');
  const existing = pairs.find(p => p.id === pairId);

  let updated: ConfusionPair[];
  if (existing) {
    existing.confusionCount += 1;
    existing.lastConfusedAt = new Date().toISOString();
    updated = [...pairs];
  } else {
    const newPair: ConfusionPair = {
      id: pairId,
      wordAId,
      wordBId,
      wordA,
      wordB,
      confusionCount: 1,
      lastConfusedAt: new Date().toISOString()
    };
    updated = [newPair, ...pairs];
  }
  localStorage.setItem(V2_KEYS.CONFUSION_PAIRS, JSON.stringify(updated));
  return updated;
}

// ----------------------------------------------------
// FAVORITES & STATS & PROFILE & SETTINGS
// ----------------------------------------------------
export function getFavorites(): string[] {
  try {
    const d = localStorage.getItem(V2_KEYS.FAVORITES);
    return d ? JSON.parse(d) : [];
  } catch {
    return [];
  }
}

export function saveFavorites(favorites: string[]): void {
  localStorage.setItem(V2_KEYS.FAVORITES, JSON.stringify(favorites));
}

export function toggleFavorite(wordId: string): string[] {
  const current = getFavorites();
  const updated = current.includes(wordId)
    ? current.filter(id => id !== wordId)
    : [...current, wordId];
  saveFavorites(updated);
  return updated;
}

export function getUserSettings(): UserSettings {
  try {
    const d = localStorage.getItem(V2_KEYS.SETTINGS);
    return d ? { ...DEFAULT_SETTINGS, ...JSON.parse(d) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveUserSettings(settings: UserSettings): void {
  localStorage.setItem(V2_KEYS.SETTINGS, JSON.stringify(settings));
}

export function getUserStats(): UserStats {
  try {
    const d = localStorage.getItem(V2_KEYS.STATS);
    if (d) return JSON.parse(d);
  } catch {}
  return {
    totalQuizzesTaken: 0,
    totalCorrect: 0,
    totalWrong: 0,
    streakDays: 1,
    lastActiveDate: new Date().toISOString(),
    mistakesMap: {},
    learnedCount: 0,
    favoriteCount: 0,
    customCardsCount: 0
  };
}

export function saveUserStats(stats: UserStats): void {
  localStorage.setItem(V2_KEYS.STATS, JSON.stringify(stats));
}

export function recordQuizResultV2(
  correctCount: number,
  wrongCount: number,
  mistakenWords: WordCard[] = []
): UserStats {
  const stats = getUserStats();
  stats.totalQuizzesTaken += 1;
  stats.totalCorrect += correctCount;
  stats.totalWrong += wrongCount;
  stats.lastActiveDate = new Date().toISOString();

  if (!stats.mistakesMap) {
    stats.mistakesMap = {};
  }

  mistakenWords.forEach(w => {
    if (stats.mistakesMap[w.id]) {
      stats.mistakesMap[w.id].wrongCount = (stats.mistakesMap[w.id].wrongCount || 1) + 1;
    } else {
      stats.mistakesMap[w.id] = { word: w, wrongCount: 1 };
    }
  });

  saveUserStats(stats);
  return stats;
}

export function clearMistakeV2(wordId: string): UserStats {
  const stats = getUserStats();
  if (stats.mistakesMap && stats.mistakesMap[wordId]) {
    delete stats.mistakesMap[wordId];
    saveUserStats(stats);
  }
  return stats;
}

export function getUnlockedBadges(): string[] {
  try {
    const d = localStorage.getItem(V2_KEYS.BADGES);
    return d ? JSON.parse(d) : ['first_step'];
  } catch {
    return ['first_step'];
  }
}

export function saveUnlockedBadges(badgeIds: string[]): void {
  localStorage.setItem(V2_KEYS.BADGES, JSON.stringify(badgeIds));
}

export function checkAndUnlockBadgesV2(): string[] {
  const unlocked = getUnlockedBadges();
  const stats = getUserStats();
  const favorites = getFavorites();
  const custom = getCustomWords();
  const learningStates = getLearningStates();

  const masteredCount = Object.values(learningStates).filter(s => s.stage === 'MASTERED').length;
  const newlyUnlocked = [...unlocked];

  BADGES_DATA.forEach(badge => {
    if (newlyUnlocked.includes(badge.id)) return;

    let conditionMet = false;

    if (badge.id === 'first_step' && (masteredCount >= 1 || favorites.length >= 1 || custom.length >= 1)) {
      conditionMet = true;
    } else if (badge.id === 'a1_master' && masteredCount >= 5) {
      conditionMet = true;
    } else if (badge.id === 'vocab_wizard' && (masteredCount + favorites.length >= 25)) {
      conditionMet = true;
    } else if (badge.id === 'book_creator' && custom.length >= 1) {
      conditionMet = true;
    } else if (
      badge.id === 'quiz_champ' &&
      stats.totalQuizzesTaken >= 1 &&
      stats.totalCorrect > 0 &&
      stats.totalCorrect / (stats.totalCorrect + stats.totalWrong) >= 0.8
    ) {
      conditionMet = true;
    } else if (badge.id === 'fav_collector' && favorites.length >= 10) {
      conditionMet = true;
    }

    if (conditionMet) {
      newlyUnlocked.push(badge.id);
    }
  });

  if (newlyUnlocked.length !== unlocked.length) {
    saveUnlockedBadges(newlyUnlocked);
  }

  return newlyUnlocked;
}

export function getUserProfile(): UserProfile {
  try {
    const d = localStorage.getItem(V2_KEYS.PROFILE);
    return d ? JSON.parse(d) : { email: null, isLoggedIn: false };
  } catch {
    return { email: null, isLoggedIn: false };
  }
}

export function saveUserProfile(profile: UserProfile): void {
  localStorage.setItem(V2_KEYS.PROFILE, JSON.stringify(profile));
}

// Convenient V2 Aliases
export const getCollectionsV2 = getCollections;
export const updateCollectionV2 = updateCollection;
export const deleteCollectionV2 = deleteCollection;
export const getMembershipsV2 = getMemberships;
export const addWordToCollectionV2 = addWordToCollection;
export const removeWordFromCollectionV2 = removeWordFromCollection;
export const getCustomWordsV2 = getCustomWords;
export const addCustomWordV2 = addCustomWord;
export const updateCustomWordV2 = updateCustomWord;
export const deleteCustomWordV2 = permanentlyDeleteWord;
export const getAllLearningStatesV2 = getLearningStates;
export const recordStudyResultV2 = recordStudyResult;
export const getFavoritesV2 = getFavorites;
export const toggleFavoriteV2 = toggleFavorite;
export const getUserStatsV2 = getUserStats;
export const getUnlockedBadgesV2 = getUnlockedBadges;
export const getUserSettingsV2 = getUserSettings;
export const saveUserSettingsV2 = saveUserSettings;
export const getUserProfileV2 = getUserProfile;
export const saveUserProfileV2 = saveUserProfile;
export const getUserWordStatusV2 = getUserWordStatus;
export const setUserWordStatusV2 = setUserWordStatus;

// ----------------------------------------------------
// FULL BACKUP EXPORT & IMPORT (schemaVersion: 2)
// ----------------------------------------------------
export function generateFullV2Backup(): V2BackupPayload {
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    collections: getCollections(),
    memberships: getMemberships(),
    customWords: getCustomWords(),
    learningStates: getLearningStates(),
    reviewHistory: getReviewHistory(),
    confusionPairs: getConfusionPairs(),
    favorites: getFavorites(),
    userSettings: getUserSettings(),
    stats: getUserStats(),
    unlockedBadges: getUnlockedBadges()
  };
}

export function restoreFullV2Backup(payload: V2BackupPayload): boolean {
  try {
    if (!payload || payload.schemaVersion !== 2) {
      throw new Error('Geçersiz yedekleme formatı veya uyumsuz sürüm.');
    }

    if (Array.isArray(payload.collections)) saveCollections(payload.collections);
    if (Array.isArray(payload.memberships)) saveMemberships(payload.memberships);
    if (Array.isArray(payload.customWords)) saveCustomWords(payload.customWords);
    if (payload.learningStates && typeof payload.learningStates === 'object') saveLearningStates(payload.learningStates);
    if (Array.isArray(payload.reviewHistory)) localStorage.setItem(V2_KEYS.REVIEW_HISTORY, JSON.stringify(payload.reviewHistory));
    if (Array.isArray(payload.confusionPairs)) localStorage.setItem(V2_KEYS.CONFUSION_PAIRS, JSON.stringify(payload.confusionPairs));
    if (Array.isArray(payload.favorites)) saveFavorites(payload.favorites);
    if (payload.userSettings) saveUserSettings(payload.userSettings);
    if (payload.stats) saveUserStats(payload.stats);
    if (Array.isArray(payload.unlockedBadges)) saveUnlockedBadges(payload.unlockedBadges);

    return true;
  } catch (err) {
    console.error('Backup restore failed:', err);
    return false;
  }
}
