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
  BadgeProgressSnapshot,
  V2BackupPayload
} from '../types';
import { BADGES_DATA } from '../data/badges';
import { createInitialLearningState, computeNextReviewState } from './srsEngine';
import { normalizeWordString } from './lemmatizer';
import { readJSON, writeJSON, readRaw, writeRaw, removeKey } from './safeStorage';
import { differenceInCalendarDays, isValidDate } from './dateUtils';

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
    const isMigrated = readRaw(V2_KEYS.MIGRATION_COMPLETED);
    if (isMigrated === 'true') {
      return;
    }

    // 1. Read existing V1 data safely
    let v1CustomCards: WordCard[] = [];
    let v1Learned: string[] = [];
    let v1Favorites: string[] = [];
    let v1Stats: any = null;
    let v1Badges: string[] = []; // rozetler koşula göre kazanılır, peşin verilmez
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

    /*
     * "Eski Özel Defterim" YALNIZCA taşınacak kart varsa açılır.
     *
     * Önceden koşulsuz oluşturuluyordu: uygulamayı ilk kez kuran kullanıcı,
     * içi boş ve adı geçmişten bahseden bir setle karşılaşıyordu — o kişinin
     * "eski defteri" hiç olmadı. Set yalnızca gerçekten eski kart varsa,
     * yani taşınacak bir şey olduğunda anlamlıdır.
     */
    const legacyDeckId = 'deck-legacy-notebook';
    if (v1CustomCards.length > 0) {
      collections.push({
        id: legacyDeckId,
        name: 'Eski Özel Defterim',
        description: 'Önceki sürümden taşınan kelime kartların',
        iconName: 'BookOpen',
        color: 'amber',
        isPinned: true,
        isArchived: false,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    } else {
      // Yeni kullanıcıya tek bir örnek set: nasıl kullanılacağını gösterir.
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
    writeJSON(V2_KEYS.COLLECTIONS, collections);
    writeJSON(V2_KEYS.MEMBERSHIPS, memberships);
    writeJSON(V2_KEYS.CUSTOM_WORDS, customWords);
    writeJSON(V2_KEYS.LEARNING_STATES, learningStates);
    writeJSON(V2_KEYS.REVIEW_HISTORY, []);
    writeJSON(V2_KEYS.CONFUSION_PAIRS, []);
    writeJSON(V2_KEYS.SETTINGS, DEFAULT_SETTINGS);
    writeJSON(V2_KEYS.FAVORITES, v1Favorites);

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
    writeJSON(V2_KEYS.STATS, finalStats);
    writeJSON(V2_KEYS.BADGES, v1Badges);
    writeJSON(V2_KEYS.PROFILE, v1Profile);

    writeRaw(V2_KEYS.MIGRATION_COMPLETED, 'true');
    console.log('✅ Version 2 Migration successfully completed.');
  } catch (err) {
    console.error('Migration error:', err);
  }
}

// ----------------------------------------------------
// COLLECTIONS
// ----------------------------------------------------
export function getCollections(): Collection[] {
  const value = readJSON<Collection[]>(V2_KEYS.COLLECTIONS, []);
  return Array.isArray(value) ? value : [];
}

export function saveCollections(collections: Collection[]): void {
  writeJSON(V2_KEYS.COLLECTIONS, collections);
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
  const value = readJSON<CollectionMembership[]>(V2_KEYS.MEMBERSHIPS, []);
  return Array.isArray(value) ? value : [];
}

export function saveMemberships(memberships: CollectionMembership[]): void {
  writeJSON(V2_KEYS.MEMBERSHIPS, memberships);
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
  return readJSON(V2_KEYS.CUSTOM_WORDS, []);
}

export function saveCustomWords(words: WordCard[]): void {
  writeJSON(V2_KEYS.CUSTOM_WORDS, words);
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
  return readJSON(V2_KEYS.LEARNING_STATES, {});
}

export function saveLearningStates(states: Record<string, LearningState>): void {
  writeJSON(V2_KEYS.LEARNING_STATES, states);
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

  // Kart çalışmak da seriyi ilerletir; seri yalnızca sınava bağlı olmamalı.
  recordActivityForStreak();

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
  return readJSON(V2_KEYS.REVIEW_HISTORY, []);
}

export function addReviewEvent(event: ReviewEvent): void {
  try {
    const history = getReviewHistory();
    const updated = [event, ...history.slice(0, MAX_REVIEW_LOGS_RETENTION - 1)];
    writeJSON(V2_KEYS.REVIEW_HISTORY, updated);
  } catch {}
}

// ----------------------------------------------------
// CONFUSION PAIRS
// ----------------------------------------------------
export function getConfusionPairs(): ConfusionPair[] {
  return readJSON(V2_KEYS.CONFUSION_PAIRS, []);
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
  writeJSON(V2_KEYS.CONFUSION_PAIRS, updated);
  return updated;
}

// ----------------------------------------------------
// FAVORITES & STATS & PROFILE & SETTINGS
// ----------------------------------------------------
export function getFavorites(): string[] {
  return readJSON(V2_KEYS.FAVORITES, []);
}

export function saveFavorites(favorites: string[]): void {
  writeJSON(V2_KEYS.FAVORITES, favorites);
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
  const stored = readJSON<Partial<UserSettings> | null>(V2_KEYS.SETTINGS, null);
  return stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;
}

export function saveUserSettings(settings: UserSettings): void {
  writeJSON(V2_KEYS.SETTINGS, settings);
}

export function createDefaultUserStats(): UserStats {
  return {
    totalQuizzesTaken: 0,
    totalCorrect: 0,
    totalWrong: 0,
    streakDays: 0,
    lastActiveDate: new Date().toISOString(),
    mistakesMap: {},
    learnedCount: 0,
    favoriteCount: 0,
    customCardsCount: 0,
    bestQuizAccuracy: 0
  };
}

export function getUserStats(): UserStats {
  const stored = readJSON<Partial<UserStats> | null>(V2_KEYS.STATS, null);
  if (!stored) return createDefaultUserStats();
  // Merge over defaults so fields added in later versions are never undefined
  // for someone upgrading from an older build.
  return { ...createDefaultUserStats(), ...stored };
}

/**
 * Günlük çalışma serisini günceller ve güncel seri uzunluğunu döner.
 *
 * Önceki sürümde `streakDays` hiçbir yerde artırılmıyordu: sabit 1 olarak
 * yazılıyor, arayüzde "1 Gün" diye gösteriliyor ve "3 günlük seri" rozeti bu
 * yüzden hiç açılamıyordu. Seri artık gerçek çalışma günlerinden hesaplanır:
 *   - aynı gün içindeki ikinci çalışma seriyi artırmaz,
 *   - dün çalışılmışsa seri bir artar,
 *   - bir gün atlanmışsa seri 1'e döner,
 *   - ileri tarihli bozuk kayıt varsa seri sıfırlanmadan korunur.
 */
export function recordActivityForStreak(now: Date = new Date()): UserStats {
  const stats = getUserStats();
  const previous = stats.lastActiveDate;

  if (!isValidDate(previous)) {
    stats.streakDays = 1;
  } else {
    const dayGap = differenceInCalendarDays(now, previous);
    if (dayGap === 0) {
      // Aynı gün tekrar çalışıldı: seri korunur, en az 1 olur.
      stats.streakDays = Math.max(1, stats.streakDays || 1);
    } else if (dayGap === 1) {
      stats.streakDays = Math.max(1, stats.streakDays || 0) + 1;
    } else if (dayGap > 1) {
      stats.streakDays = 1;
    } else {
      // Saat farkı/cihaz saati nedeniyle geçmişe dönük kayıt: seriyi bozma.
      stats.streakDays = Math.max(1, stats.streakDays || 1);
    }
  }

  stats.lastActiveDate = now.toISOString();
  saveUserStats(stats);
  return stats;
}

export function saveUserStats(stats: UserStats): void {
  writeJSON(V2_KEYS.STATS, stats);
}

export function recordQuizResultV2(
  correctCount: number,
  wrongCount: number,
  mistakenWords: WordCard[] = []
): UserStats {
  // Sınav da bir çalışma etkinliğidir: önce günlük seriyi güncelle.
  const stats = recordActivityForStreak();
  stats.totalQuizzesTaken += 1;
  stats.totalCorrect += correctCount;
  stats.totalWrong += wrongCount;

  // "Kusursuz Başarı" rozeti için bu sınavın doğruluk oranını sakla.
  const answered = correctCount + wrongCount;
  if (answered > 0) {
    const accuracy = correctCount / answered;
    stats.bestQuizAccuracy = Math.max(stats.bestQuizAccuracy || 0, accuracy);
  }

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
  const value = readJSON<string[]>(V2_KEYS.BADGES, []);
  return Array.isArray(value) ? value : [];
}

export function saveUnlockedBadges(badgeIds: string[]): void {
  writeJSON(V2_KEYS.BADGES, badgeIds);
}

export function buildBadgeProgressSnapshot(): BadgeProgressSnapshot {
  const stats = getUserStats();
  const learningStates = getLearningStates();
  return {
    masteredCount: Object.values(learningStates).filter(st => st.stage === 'MASTERED').length,
    favoritesCount: getFavorites().length,
    customWordsCount: getCustomWords().length,
    collectionsCount: getCollections().length,
    streakDays: stats.streakDays || 0,
    totalQuizzesTaken: stats.totalQuizzesTaken || 0,
    totalCorrect: stats.totalCorrect || 0,
    totalWrong: stats.totalWrong || 0,
    bestQuizAccuracy: stats.bestQuizAccuracy || 0
  };
}

/**
 * Kazanılan rozetleri hesaplar ve yenilerini kaydeder.
 *
 * Koşullar `BADGES_DATA` içindeki `isEarned` fonksiyonlarından okunur; burada
 * ayrı bir kimlik listesi tutulmaz. Böylece rozet tanımı ile kilit açma kuralı
 * arasındaki kayma (eski sürümde altı rozetten beşini açılamaz hale getiren
 * hata) tekrarlanamaz.
 */
export function checkAndUnlockBadgesV2(): string[] {
  const unlocked = getUnlockedBadges();
  const progress = buildBadgeProgressSnapshot();
  const knownIds = new Set(BADGES_DATA.map(b => b.id));

  // Tanımı kaldırılmış rozet kimliklerini ayıkla; aksi halde arayüzdeki
  // "kazanılan / toplam" sayacı gerçekte görünmeyen rozetleri sayar.
  const result = unlocked.filter(id => knownIds.has(id));

  BADGES_DATA.forEach(badge => {
    if (result.includes(badge.id)) return;
    let earned = false;
    try {
      earned = badge.isEarned(progress);
    } catch (err) {
      console.error(`Rozet koşulu değerlendirilemedi: ${badge.id}`, err);
    }
    if (earned) result.push(badge.id);
  });

  if (result.length !== unlocked.length || result.some((id, i) => id !== unlocked[i])) {
    saveUnlockedBadges(result);
  }

  return result;
}

export function getUserProfile(): UserProfile {
  return readJSON(V2_KEYS.PROFILE, { email: null, isLoggedIn: false });
}

export function saveUserProfile(profile: UserProfile): void {
  writeJSON(V2_KEYS.PROFILE, profile);
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
export const recordActivityForStreakV2 = recordActivityForStreak;
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
    if (Array.isArray(payload.reviewHistory)) writeJSON(V2_KEYS.REVIEW_HISTORY, payload.reviewHistory);
    if (Array.isArray(payload.confusionPairs)) writeJSON(V2_KEYS.CONFUSION_PAIRS, payload.confusionPairs);
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
