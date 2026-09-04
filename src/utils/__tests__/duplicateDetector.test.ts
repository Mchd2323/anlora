import { describe, it, expect, vi } from 'vitest';
import { detectWordDuplicate } from '../duplicateDetector';
import { WordCard, Collection, CollectionMembership } from '../../types';

/*
 * `normalizeWordString` çağrılarını sayan sarmalayıcı.
 *
 * Aşağıdaki başarım testi eskiden yalnızca süre ölçüyordu (`< 1000 ms`) ve
 * ölçülen gerçek maliyet birkaç milisaniyeydi: indeks önbelleği tamamen
 * silinse bile süre eşiğin çok altında kalıyor, yani test koruduğunu iddia
 * ettiği gerilemeyi göremiyordu. Toplu kelime eklerken arayüzün donması tam
 * da bu yüzden fark edilmeden geri gelebilirdi.
 *
 * Süre yerine YAPILAN İŞ sayılıyor: normalize çağrısı sayısı hem makineden
 * hem yükten bağımsızdır ve önbellek kaldırıldığı anda iki kat büyür.
 * Sarmalayıcı gerçek uygulamaya devrettiği için dosyadaki diğer testlerin
 * davranışı değişmez.
 */
const sayac = vi.hoisted(() => ({ normalize: 0 }));

vi.mock('../lemmatizer', async importOriginal => {
  const gercek = await importOriginal<typeof import('../lemmatizer')>();
  return {
    ...gercek,
    normalizeWordString: (girdi: string) => {
      sayac.normalize++;
      return gercek.normalizeWordString(girdi);
    }
  };
});

function makeWord(id: string, word: string, level: any = 'A1'): WordCard {
  return { id, word, level, partOfSpeech: 'n.', turkishMeaning: 'anlam', examples: [] } as WordCard;
}

const OXFORD = [
  makeWord('ox-book', 'book'),
  makeWord('ox-run', 'run'),
  makeWord('ox-study', 'study'),
  makeWord('ox-stop', 'stop')
];

const COLLECTIONS: Collection[] = [
  { id: 'c1', name: 'Dizi Kelimeleri', createdAt: '', updatedAt: '' } as Collection,
  { id: 'c2', name: 'Sınav', createdAt: '', updatedAt: '' } as Collection
];

describe('detectWordDuplicate', () => {
  it('boş girdide NONE döner', () => {
    const result = detectWordDuplicate({
      rawWord: '   ',
      collections: COLLECTIONS,
      memberships: [],
      customWords: [],
      oxfordWords: OXFORD
    });
    expect(result.type).toBe('NONE');
  });

  it('Oxford eşleşmesini bulur', () => {
    const result = detectWordDuplicate({
      rawWord: 'Book',
      collections: COLLECTIONS,
      memberships: [],
      customWords: [],
      oxfordWords: OXFORD
    });
    expect(result.type).toBe('EXACT_IN_OXFORD');
    expect(result.matchedWordCard?.id).toBe('ox-book');
  });

  it('hedef koleksiyondaki tekrarı bildirir', () => {
    const memberships: CollectionMembership[] = [
      { wordId: 'ox-book', collectionId: 'c1' } as CollectionMembership
    ];
    const result = detectWordDuplicate({
      rawWord: 'book',
      targetCollectionId: 'c1',
      collections: COLLECTIONS,
      memberships,
      customWords: [],
      oxfordWords: OXFORD
    });
    expect(result.type).toBe('EXACT_IN_COLLECTION');
    expect(result.matchedCollectionName).toBe('Dizi Kelimeleri');
  });

  it('başka koleksiyondaki tekrarı bildirir', () => {
    const memberships: CollectionMembership[] = [
      { wordId: 'ox-book', collectionId: 'c2' } as CollectionMembership
    ];
    const result = detectWordDuplicate({
      rawWord: 'book',
      targetCollectionId: 'c1',
      collections: COLLECTIONS,
      memberships,
      customWords: [],
      oxfordWords: OXFORD
    });
    expect(result.type).toBe('EXACT_IN_OTHER_COLLECTION');
    expect(result.otherCollectionNames).toContain('Sınav');
  });

  it('çekimli biçimi taban kelimeye bağlar', () => {
    const result = detectWordDuplicate({
      rawWord: 'studies',
      collections: COLLECTIONS,
      memberships: [],
      customWords: [],
      oxfordWords: OXFORD
    });
    expect(result.type).toBe('INFLECTED_FORM');
    expect(result.matchedWordCard?.id).toBe('ox-study');
  });

  it('ünsüz ikizlenmesini doğru çözer', () => {
    // "stopped" -> "stopp" değil "stop".
    const result = detectWordDuplicate({
      rawWord: 'stopped',
      collections: COLLECTIONS,
      memberships: [],
      customWords: [],
      oxfordWords: OXFORD
    });
    expect(result.type).toBe('INFLECTED_FORM');
    expect(result.matchedWordCard?.id).toBe('ox-stop');
  });

  it('sözlükte olmayan kelimede tekrar bildirmez', () => {
    const result = detectWordDuplicate({
      rawWord: 'zephyr',
      collections: COLLECTIONS,
      memberships: [],
      customWords: [],
      oxfordWords: OXFORD
    });
    expect(result.type).toBe('NONE');
  });

  it('koleksiyondaki özel kelimeyi Oxford karşılığından önce bildirir', () => {
    const custom = [makeWord('custom-1', 'book')];
    const memberships: CollectionMembership[] = [
      { wordId: 'custom-1', collectionId: 'c1' } as CollectionMembership
    ];
    const result = detectWordDuplicate({
      rawWord: 'book',
      targetCollectionId: 'c1',
      collections: COLLECTIONS,
      memberships,
      customWords: custom,
      oxfordWords: OXFORD
    });
    expect(result.type).toBe('EXACT_IN_COLLECTION');
    expect(result.matchedWordCard?.id).toBe('custom-1');
  });

  it('canonicalWord üzerinden de eşleşir', () => {
    const custom = [{ ...makeWord('custom-2', 'ran'), canonicalWord: 'sprint' } as WordCard];
    const memberships: CollectionMembership[] = [
      { wordId: 'custom-2', collectionId: 'c1' } as CollectionMembership
    ];
    const result = detectWordDuplicate({
      rawWord: 'sprint',
      targetCollectionId: 'c1',
      collections: COLLECTIONS,
      memberships,
      customWords: custom,
      oxfordWords: OXFORD
    });
    expect(result.matchedWordCard?.id).toBe('custom-2');
  });

  it('büyük listede indeksi yalnızca bir kez kurar (indeks önbelleği)', () => {
    // Önceki sürüm her çağrıda tüm listeyi tarayıp her karşılaştırmada
    // normalizeWordString çalıştırıyordu; toplu eklemede arayüz donuyordu.
    const big = Array.from({ length: 4000 }, (_, i) => makeWord(`w${i}`, `word${i}`));
    const cagriSayisi = 200;

    sayac.normalize = 0;
    for (let i = 0; i < cagriSayisi; i++) {
      detectWordDuplicate({
        rawWord: `word${i}`,
        collections: COLLECTIONS,
        memberships: [],
        customWords: [],
        oxfordWords: big
      });
    }

    // İndeks kurulurken liste bir kez baştan sona normalize edilir.
    expect(sayac.normalize).toBeGreaterThanOrEqual(big.length);
    // Ama YALNIZCA bir kez: sonraki çağrılar aynı dizi referansını gördüğü
    // için önbellekten okur ve çağrı başına sabit iş yapar. Önbellek
    // kaldırılsa bu sayı 4.200 yerine 800.200 olur ve test kırmızıya döner.
    expect(sayac.normalize).toBeLessThan(big.length + cagriSayisi * 5);
  });
});
