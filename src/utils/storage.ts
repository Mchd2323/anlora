import { WordCard, UserStats, UserProfile } from '../types';
import { BADGES_DATA } from '../data/oxfordWords';

const KEYS = {
  FAVORITES: 'oxford_3000_favorites_v1',
  LEARNED: 'oxford_3000_learned_v1',
  CUSTOM_CARDS: 'oxford_3000_custom_cards_v1',
  STATS: 'oxford_3000_user_stats_v1',
  UNLOCKED_BADGES: 'oxford_3000_unlocked_badges_v1',
  PROFILE: 'oxford_3000_user_profile_v1'
};

export function getFavorites(): string[] {
  try {
    const data = localStorage.getItem(KEYS.FAVORITES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveFavorites(favorites: string[]): void {
  localStorage.setItem(KEYS.FAVORITES, JSON.stringify(favorites));
  triggerCloudSyncIfLoggedIn();
}

export function toggleFavoriteInStorage(wordId: string): string[] {
  const current = getFavorites();
  let updated: string[];
  if (current.includes(wordId)) {
    updated = current.filter((id) => id !== wordId);
  } else {
    updated = [...current, wordId];
  }
  saveFavorites(updated);
  return updated;
}

export function getLearnedWords(): string[] {
  try {
    const data = localStorage.getItem(KEYS.LEARNED);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveLearnedWords(learned: string[]): void {
  localStorage.setItem(KEYS.LEARNED, JSON.stringify(learned));
  triggerCloudSyncIfLoggedIn();
}

export function toggleLearnedInStorage(wordId: string): string[] {
  const current = getLearnedWords();
  let updated: string[];
  if (current.includes(wordId)) {
    updated = current.filter((id) => id !== wordId);
  } else {
    updated = [...current, wordId];
  }
  saveLearnedWords(updated);
  return updated;
}

export function getCustomCards(): WordCard[] {
  try {
    const data = localStorage.getItem(KEYS.CUSTOM_CARDS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveCustomCards(cards: WordCard[]): void {
  localStorage.setItem(KEYS.CUSTOM_CARDS, JSON.stringify(cards));
  triggerCloudSyncIfLoggedIn();
}

export async function fetchCloudCustomCards(): Promise<WordCard[]> {
  try {
    const res = await fetch('/api/custom-cards');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.cards) && data.cards.length > 0) {
        // Merge cloud cards with local cards (cloud preferred for duplicates)
        const localCards = getCustomCards();
        const map = new Map<string, WordCard>();
        localCards.forEach(c => map.set(c.id, c));
        data.cards.forEach((c: WordCard) => map.set(c.id, c));
        const merged = Array.from(map.values());
        saveCustomCards(merged);
        return merged;
      }
    }
  } catch (err) {
    console.warn('Buluttan özel kelimeler çekilirken bağlantı hatası:', err);
  }
  return getCustomCards();
}

export function addCustomCardToStorage(card: WordCard): WordCard[] {
  const current = getCustomCards();
  const updated = [card, ...current.filter(c => c.id !== card.id)];
  saveCustomCards(updated);

  // Background async call to cloud API
  fetch('/api/custom-cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card)
  }).catch(err => console.warn('Bulut kaydetme hatası:', err));

  return updated;
}

export function updateCustomCardInStorage(updatedCard: WordCard): WordCard[] {
  const current = getCustomCards();
  const updated = current.map(c => c.id === updatedCard.id ? updatedCard : c);
  saveCustomCards(updated);

  // Background async call to cloud API
  fetch(`/api/custom-cards/${updatedCard.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedCard)
  }).catch(err => console.warn('Bulut güncelleme hatası:', err));

  return updated;
}

export function removeCustomCardFromStorage(cardId: string): WordCard[] {
  const current = getCustomCards();
  const updated = current.filter((c) => c.id !== cardId);
  saveCustomCards(updated);

  // Background async call to cloud API
  fetch(`/api/custom-cards/${cardId}`, {
    method: 'DELETE'
  }).catch(err => console.warn('Bulut silme hatası:', err));

  return updated;
}

export function getUserStats(): UserStats {
  try {
    const data = localStorage.getItem(KEYS.STATS);
    if (data) {
      return JSON.parse(data);
    }
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
  localStorage.setItem(KEYS.STATS, JSON.stringify(stats));
  triggerCloudSyncIfLoggedIn();
}

export function recordQuizAttempt(
  correctCount: number,
  wrongCount: number,
  mistakenWords: WordCard[]
): UserStats {
  const stats = getUserStats();
  stats.totalQuizzesTaken += 1;
  stats.totalCorrect += correctCount;
  stats.totalWrong += wrongCount;
  stats.lastActiveDate = new Date().toISOString();

  // Record mistakes
  mistakenWords.forEach((word) => {
    if (stats.mistakesMap[word.id]) {
      stats.mistakesMap[word.id].wrongCount += 1;
    } else {
      stats.mistakesMap[word.id] = { word, wrongCount: 1 };
    }
  });

  saveUserStats(stats);
  checkAndUnlockBadges();
  return stats;
}

export function clearMistakeFromStorage(wordId: string): UserStats {
  const stats = getUserStats();
  if (stats.mistakesMap[wordId]) {
    delete stats.mistakesMap[wordId];
    saveUserStats(stats);
  }
  return stats;
}

export function getUnlockedBadges(): string[] {
  try {
    const data = localStorage.getItem(KEYS.UNLOCKED_BADGES);
    return data ? JSON.parse(data) : ['first_step'];
  } catch {
    return ['first_step'];
  }
}

export function saveUnlockedBadges(badgeIds: string[]): void {
  localStorage.setItem(KEYS.UNLOCKED_BADGES, JSON.stringify(badgeIds));
  triggerCloudSyncIfLoggedIn();
}

export function checkAndUnlockBadges(): string[] {
  const unlocked = getUnlockedBadges();
  const stats = getUserStats();
  const favorites = getFavorites();
  const learned = getLearnedWords();
  const custom = getCustomCards();

  const newlyUnlocked = [...unlocked];

  BADGES_DATA.forEach((badge) => {
    if (newlyUnlocked.includes(badge.id)) return;

    let conditionMet = false;

    if (badge.id === 'first_step' && (learned.length >= 1 || favorites.length >= 1)) {
      conditionMet = true;
    } else if (badge.id === 'a1_master' && learned.length >= 5) {
      conditionMet = true;
    } else if (badge.id === 'vocab_wizard' && (learned.length + favorites.length >= 25)) {
      conditionMet = true;
    } else if (badge.id === 'book_creator' && custom.length >= 1) {
      conditionMet = true;
    } else if (badge.id === 'quiz_champ' && stats.totalQuizzesTaken >= 1 && stats.totalCorrect > 0 && (stats.totalCorrect / (stats.totalCorrect + stats.totalWrong) >= 0.8)) {
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
    const data = localStorage.getItem(KEYS.PROFILE);
    return data ? JSON.parse(data) : { email: null, isLoggedIn: false };
  } catch {
    return { email: null, isLoggedIn: false };
  }
}

export function saveUserProfile(profile: UserProfile): void {
  localStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
}

async function triggerCloudSyncIfLoggedIn() {
  const profile = getUserProfile();
  if (!profile.isLoggedIn || !profile.email) return;

  try {
    const userData = {
      favorites: getFavorites(),
      learned: getLearnedWords(),
      customWords: getCustomCards(),
      stats: getUserStats(),
      unlockedBadges: getUnlockedBadges()
    };

    await fetch('/api/sync/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: profile.email, userData })
    });
  } catch (err) {
    console.warn('Bulut eşitleme hatası:', err);
  }
}
