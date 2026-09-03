import { describe, it, expect } from 'vitest';
import { aramaAnahtari } from '../aramaAnahtari';

describe('aramaAnahtari', () => {
  it('Türkçe büyük İ ile yazılan sorgu İngilizce kelimeyle eşleşir', () => {
    // Bu, düzeltilen hatanın ta kendisi: Android klavyesi ilk harfi büyütür.
    expect(aramaAnahtari('İsland')).toBe(aramaAnahtari('island'));
  });

  it('noktasız ı ile yazılan sorgu da eşleşir', () => {
    expect(aramaAnahtari('ısland')).toBe('island');
  });

  it('varsayılan toLowerCase bu işi yapamıyor (hatanın kanıtı)', () => {
    // 'İ'.toLowerCase() iki kod noktası üretir: 'i' + U+0307.
    expect('İsland'.toLowerCase()).not.toBe('island');
    expect('İsland'.toLowerCase().length).toBe(7);
  });

  it('tek kod noktasına iner', () => {
    expect([...aramaAnahtari('İ')].length).toBe(1);
  });

  it('Türkçe anlamlarda iki taraf aynı dönüşümden geçtiği için eşleşme korunur', () => {
    expect(aramaAnahtari('ışık')).toBe(aramaAnahtari('IŞIK'));
  });

  it('İngilizce olmayan harfleri ayrıştırmaz', () => {
    // NFD kullanılsaydı é ayrışıp e + aksan olurdu ve eşleşme bozulurdu.
    expect([...aramaAnahtari('café')].length).toBe(4);
  });

  it('boş ve tanımsız girdide çökmez', () => {
    expect(aramaAnahtari('')).toBe('');
    expect(aramaAnahtari(undefined as unknown as string)).toBe('');
  });

  it('baştaki ve sondaki boşluğu atar', () => {
    expect(aramaAnahtari('  Island  ')).toBe('island');
  });
});
