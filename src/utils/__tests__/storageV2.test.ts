import { describe, it, expect, beforeEach } from 'vitest';
import { BADGES_DATA } from '../../data/oxfordWords';
import { BadgeProgressSnapshot } from '../../types';

function emptyProgress(): BadgeProgressSnapshot {
  return {
    masteredCount: 0,
    favoritesCount: 0,
    customWordsCount: 0,
    collectionsCount: 0,
    streakDays: 0,
    totalQuizzesTaken: 0,
    totalCorrect: 0,
    totalWrong: 0,
    bestQuizAccuracy: 0
  };
}

describe('rozet tanımları', () => {
  it('her rozetin bir kilit açma koşulu vardır', () => {
    // Asıl hata: koşullar ayrı bir listede tutulduğu için kimlikler kaymıştı ve
    // altı rozetten beşi hiçbir koşulla eşleşmiyordu.
    for (const badge of BADGES_DATA) {
      expect(typeof badge.isEarned).toBe('function');
    }
  });

  it('rozet kimlikleri benzersizdir', () => {
    const ids = BADGES_DATA.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sıfır ilerlemede hiçbir rozet açık değildir', () => {
    const progress = emptyProgress();
    for (const badge of BADGES_DATA) {
      expect(badge.isEarned(progress)).toBe(false);
    }
  });

  it('her rozet uygun ilerlemeyle kazanılabilir', () => {
    // Ulaşılamayan rozet, kullanıcıya asla dolmayacak bir sayaç göstermektir.
    const maxedProgress: BadgeProgressSnapshot = {
      masteredCount: 1000,
      favoritesCount: 1000,
      customWordsCount: 1000,
      collectionsCount: 1000,
      streakDays: 1000,
      totalQuizzesTaken: 1000,
      totalCorrect: 1000,
      totalWrong: 0,
      bestQuizAccuracy: 1
    };
    for (const badge of BADGES_DATA) {
      expect(badge.isEarned(maxedProgress), `${badge.id} kazanılamıyor`).toBe(true);
    }
  });
});
