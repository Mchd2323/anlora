import { describe, it, expect, beforeEach, vi } from 'vitest';

/** Yazma sayısını sayan sahte localStorage. */
const store = new Map<string, string>();
let setItemSayisi = 0;
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { setItemSayisi++; store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  length: 0
});

const { setUserWordStatus, setUserWordStatuses } = await import('../storageV2');

describe('toplu işaretleme tek yazmada', () => {
  beforeEach(() => { store.clear(); setItemSayisi = 0; });

  it('20 kelime: tek tek vs toplu', () => {
    const idler = Array.from({ length: 20 }, (_, i) => `w-${i}`);

    setItemSayisi = 0;
    idler.forEach(id => setUserWordStatus(id, 'learned'));
    const tekTek = setItemSayisi;

    store.clear();
    setItemSayisi = 0;
    setUserWordStatuses(idler, 'learned');
    const toplu = setItemSayisi;

    console.log(`  tek tek: ${tekTek} yazma | toplu: ${toplu} yazma`);
    expect(toplu).toBeLessThan(tekTek);
    expect(toplu).toBeLessThanOrEqual(2);
  });

  it('sonuç aynı: 20 kelimenin hepsi öğrenildi', () => {
    const idler = Array.from({ length: 20 }, (_, i) => `w-${i}`);
    const durumlar = setUserWordStatuses(idler, 'learned');
    expect(Object.keys(durumlar)).toHaveLength(20);
    expect(idler.every(id => durumlar[id].userStatus === 'learned')).toBe(true);
    expect(idler.every(id => durumlar[id].stage === 'MASTERED')).toBe(true);
  });
});
