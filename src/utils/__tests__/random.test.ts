import { describe, it, expect } from 'vitest';
import { shuffle, sample, pickOne } from '../random';

describe('shuffle', () => {
  it('kaynağı değiştirmez ve tüm öğeleri korur', () => {
    const source = [1, 2, 3, 4, 5];
    const result = shuffle(source);
    expect(source).toEqual([1, 2, 3, 4, 5]);
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('boş diziyle çalışır', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('düzgün dağılım üretir', () => {
    // Bozuk `sort(() => 0.5 - Math.random())` yöntemi burada başarısız olur:
    // ilk öğe ezici çoğunlukla ilk konumda kalır.
    const RUNS = 6000;
    const positionCounts = [0, 0, 0, 0];

    for (let i = 0; i < RUNS; i++) {
      const result = shuffle(['a', 'b', 'c', 'd']);
      positionCounts[result.indexOf('a')]++;
    }

    const expected = RUNS / 4;
    for (const count of positionCounts) {
      // Her konum beklenenin %20'si içinde kalmalı.
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.2);
    }
  });
});

describe('sample', () => {
  it('istenen sayıda benzersiz öğe döner', () => {
    const picked = sample([1, 2, 3, 4, 5, 6, 7, 8], 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
  });

  it('istenen sayı diziden büyükse tüm diziyi döner', () => {
    const picked = sample([1, 2, 3], 10);
    expect([...picked].sort()).toEqual([1, 2, 3]);
  });
});

describe('pickOne', () => {
  it('boş dizide undefined döner', () => {
    expect(pickOne([])).toBeUndefined();
  });
});
