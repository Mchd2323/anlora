import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Yedekleme döngüsü testleri.
 *
 * Önceki sürümde "Verilerimi Yedekle" düğmesi `generateFullV2Backup`
 * kullanmıyor, kendi uydurma biçimini yazıyordu. Sonuç: (a) koleksiyonlar ve
 * üyelikler yedeğe hiç girmiyordu, (b) üretilen dosya `restoreFullV2Backup`
 * ile geri yüklenemiyordu. Kullanıcı yedek aldığını sanıyordu.
 */

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

const storage = new MemoryStorage();
vi.stubGlobal('localStorage', storage);

const {
  generateFullV2Backup,
  restoreFullV2Backup,
  createCollectionV2,
  getCollectionsV2,
  addWordToCollectionV2,
  getMembershipsV2,
  toggleFavoriteV2,
  getFavoritesV2,
  saveLearningStates,
  getLearningStates,
  saveUserStats,
  getUserStats,
  createDefaultUserStats,
  saveUnlockedBadges,
  getUnlockedBadges,
  addReviewEvent,
  getReviewHistory
} = await import('../storageV2');

const { createInitialLearningState } = await import('../srsEngine');
const { BADGES_DATA } = await import('../../data/badges');

/** Rozet kimliğini uydurmuyoruz; listede gerçekten var olan biri kullanılıyor. */
const ROZET_ID = BADGES_DATA[0].id;

/**
 * Yedeğin taşıması gereken ilerleme verisini tohumlar.
 *
 * Koleksiyon ve favori kaybı can sıkıcıdır ama yeniden kurulabilir; aralıklı
 * tekrar takvimi (`learningStates`), istatistikler, rozetler ve tekrar geçmişi
 * ise YENİDEN ÜRETİLEMEZ — aylarca çalışmanın tek kaydı bunlardır. Testler
 * bugüne kadar yalnızca koleksiyon/üyelik/favori iddia ediyordu; yedek
 * yolundan ilerleme sessizce düşse paket yeşil kalıyordu ve kullanıcı cihaz
 * değiştirip geri yüklediğinde her şeyi sıfırdan öğrenmeye başlıyordu.
 */
function ilerlemeTohumla(): void {
  saveLearningStates({
    'ox-run': { ...createInitialLearningState('ox-run', 'MASTERED'), intervalDays: 21 }
  });
  saveUserStats({ ...createDefaultUserStats(), totalCorrect: 42 });
  saveUnlockedBadges([ROZET_ID]);
  addReviewEvent({
    id: 'rev-1',
    wordId: 'ox-run',
    timestamp: '2025-01-01T00:00:00.000Z',
    quality: 'good',
    mode: 'flashcard',
    isCorrect: true
  });
}

describe('yedekleme döngüsü', () => {
  beforeEach(() => storage.clear());

  it('yedek koleksiyonları ve üyelikleri içerir', () => {
    const deck = createCollectionV2('Dizi Kelimeleri');
    addWordToCollectionV2('ox-book', deck.id);

    const payload = generateFullV2Backup();
    expect(payload.schemaVersion).toBe(2);
    expect(payload.collections).toHaveLength(1);
    expect(payload.collections[0].name).toBe('Dizi Kelimeleri');
    expect(payload.memberships).toHaveLength(1);
  });

  it('yedek öğrenme durumlarını ve istatistikleri de içerir', () => {
    // Üretme yanı ayrıca korunuyor: `generateFullV2Backup`'tan tek bir alan
    // düşse (ör. `learningStates`) geri yükleme testi hâlâ geçebilirdi,
    // çünkü o zaman yedekte de diskte de aynı boşluk olurdu.
    ilerlemeTohumla();

    const payload = generateFullV2Backup();
    expect(payload.learningStates['ox-run'].stage).toBe('MASTERED');
    expect(payload.stats.totalCorrect).toBe(42);
    expect(payload.unlockedBadges).toContain(ROZET_ID);
    expect(payload.reviewHistory).toHaveLength(1);
  });

  it('dışa aktarılan yedek geri yüklenebilir', () => {
    const deck = createCollectionV2('Sınav');
    addWordToCollectionV2('ox-run', deck.id);
    toggleFavoriteV2('ox-run');
    ilerlemeTohumla();
    const payload = generateFullV2Backup();

    storage.clear();
    expect(getCollectionsV2()).toHaveLength(0);

    expect(restoreFullV2Backup(payload)).toBe(true);
    expect(getCollectionsV2()).toHaveLength(1);
    expect(getCollectionsV2()[0].name).toBe('Sınav');
    expect(getMembershipsV2()).toHaveLength(1);
    expect(getFavoritesV2()).toContain('ox-run');

    // Asıl kurtarılması gereken veri: tekrar takvimi ve ilerleme.
    expect(getLearningStates()['ox-run'].stage).toBe('MASTERED');
    expect(getLearningStates()['ox-run'].intervalDays).toBe(21);
    expect(getUserStats().totalCorrect).toBe(42);
    expect(getUnlockedBadges()).toContain(ROZET_ID);
    expect(getReviewHistory()).toHaveLength(1);
    expect(getReviewHistory()[0].wordId).toBe('ox-run');
  });

  it('uyumsuz sürümü reddeder', () => {
    expect(restoreFullV2Backup({ schemaVersion: 1 } as any)).toBe(false);
  });

  it('bozuk yükte çökmez', () => {
    expect(restoreFullV2Backup(null as any)).toBe(false);
    expect(restoreFullV2Backup({} as any)).toBe(false);
  });

  it('eksik alanlı yedekte var olanları geri yükler', () => {
    const partial = { schemaVersion: 2, collections: [{ id: 'c1', name: 'Kısmi' }] } as any;
    expect(restoreFullV2Backup(partial)).toBe(true);
    expect(getCollectionsV2()[0].name).toBe('Kısmi');
  });
});
