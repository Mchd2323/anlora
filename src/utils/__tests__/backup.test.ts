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
  getFavoritesV2
} = await import('../storageV2');

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

  it('dışa aktarılan yedek geri yüklenebilir', () => {
    const deck = createCollectionV2('Sınav');
    addWordToCollectionV2('ox-run', deck.id);
    toggleFavoriteV2('ox-run');
    const payload = generateFullV2Backup();

    storage.clear();
    expect(getCollectionsV2()).toHaveLength(0);

    expect(restoreFullV2Backup(payload)).toBe(true);
    expect(getCollectionsV2()).toHaveLength(1);
    expect(getCollectionsV2()[0].name).toBe('Sınav');
    expect(getMembershipsV2()).toHaveLength(1);
    expect(getFavoritesV2()).toContain('ox-run');
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
