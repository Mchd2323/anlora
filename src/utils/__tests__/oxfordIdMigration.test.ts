import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Oxford kimlik göçü testleri.
 *
 * Oxford verisi resmî kaynaklardan yeniden üretildiğinde kayıt kimlikleri
 * değişti. Kullanıcının "Öğrendim", "Tekrar Et", favori ve çalışma geçmişi bu
 * kimliklere bağlı olduğu için göç yapılmazsa TÜM ilerleme kaybolur.
 */

class MemoryStorage {
  store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

const storage = new MemoryStorage();
vi.stubGlobal('localStorage', storage);

const { runOxfordIdMigrationIfNeeded, mapOxfordId } = await import('../oxfordIdMigration');
const { V2_KEYS, getLearningStates, saveLearningStates, getFavorites, saveFavorites,
        getMemberships, saveMemberships } = await import('../storageV2');
const ID_MAP = (await import('../../data/oxfordIdMigration.json')).default as Record<string, string>;

const [OLD_ID, NEW_ID] = Object.entries(ID_MAP)[0];

describe('mapOxfordId', () => {
  it('bilinen eski kimliği yeniye çevirir', () => {
    expect(mapOxfordId(OLD_ID)).toBe(NEW_ID);
  });

  it('bilinmeyen kimliği olduğu gibi bırakır', () => {
    expect(mapOxfordId('custom-1234')).toBe('custom-1234');
  });

  it('eşleme boş değildir', () => {
    expect(Object.keys(ID_MAP).length).toBeGreaterThan(1000);
  });
});

describe('runOxfordIdMigrationIfNeeded', () => {
  beforeEach(() => storage.clear());

  it('öğrenme durumlarını yeni kimliğe taşır', () => {
    saveLearningStates({
      [OLD_ID]: { wordId: OLD_ID, stage: 'MASTERED', masteryScore: 90 } as any
    });

    const report = runOxfordIdMigrationIfNeeded();
    expect(report.learningStates).toBe(1);

    const states = getLearningStates();
    expect(states[NEW_ID]).toBeDefined();
    expect(states[NEW_ID].stage).toBe('MASTERED');
    expect(states[NEW_ID].masteryScore).toBe(90);
    // wordId alanı da tutarlı olmalı
    expect(states[NEW_ID].wordId).toBe(NEW_ID);
    expect(states[OLD_ID]).toBeUndefined();
  });

  it('favorileri taşır', () => {
    saveFavorites([OLD_ID, 'custom-99']);
    runOxfordIdMigrationIfNeeded();
    const favorites = getFavorites();
    expect(favorites).toContain(NEW_ID);
    expect(favorites).toContain('custom-99');
    expect(favorites).not.toContain(OLD_ID);
  });

  it('koleksiyon üyeliklerini taşır', () => {
    saveMemberships([{ wordId: OLD_ID, collectionId: 'c1' } as any]);
    runOxfordIdMigrationIfNeeded();
    expect(getMemberships()[0].wordId).toBe(NEW_ID);
  });

  it('kişisel kelimelere dokunmaz', () => {
    saveLearningStates({
      'custom-abc': { wordId: 'custom-abc', stage: 'REVIEW' } as any
    });
    runOxfordIdMigrationIfNeeded();
    expect(getLearningStates()['custom-abc']).toBeDefined();
  });

  it('yalnızca bir kez çalışır', () => {
    saveFavorites([OLD_ID]);
    const first = runOxfordIdMigrationIfNeeded();
    expect(first.alreadyMigrated).toBe(false);

    const second = runOxfordIdMigrationIfNeeded();
    expect(second.alreadyMigrated).toBe(true);
    expect(second.favorites).toBe(0);
  });

  it('boş veride çökmez', () => {
    expect(() => runOxfordIdMigrationIfNeeded()).not.toThrow();
  });

  it('çalışma geçmişindeki kimlikleri taşır', () => {
    storage.setItem(
      V2_KEYS.REVIEW_HISTORY,
      JSON.stringify([{ id: 'r1', wordId: OLD_ID, timestamp: '', quality: 'good', mode: 'flashcard', isCorrect: true }])
    );
    const report = runOxfordIdMigrationIfNeeded();
    expect(report.reviewHistory).toBe(1);
    const history = JSON.parse(storage.getItem(V2_KEYS.REVIEW_HISTORY)!);
    expect(history[0].wordId).toBe(NEW_ID);
  });
});
