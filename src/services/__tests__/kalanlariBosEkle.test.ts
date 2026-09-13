import { describe, it, expect, beforeEach } from 'vitest';
import { kalanlariBosEkle, kuyrugaAl, kuyrugaTemizle, kuyruguOku, bosKart } from '../topluKuyruk';
import type { WordCard } from '../../types';

/**
 * KOTA DOLUNCA KULLANICI KELİMELERİNİ KAYBETMESİN.
 *
 * Kullanıcının bildirdiği durum: altmış yedi kelimelik liste kuyrukta,
 * günlük yapay zekâ hakkı dolmuş, "baya zaman geçti 67'den 63'e indi ama
 * aynı uyarıyı hâlâ veriyor." Elinde iki seçenek vardı -- saatlerce beklemek
 * ya da listeyi iptal edip yazdığı her şeyi çöpe atmak. Üçüncü yol:
 * kalanlar kart olarak eklenir, anlam alanı BOŞ bırakılır, kuyruk kapanır.
 */
describe('kalanlariBosEkle', () => {
  beforeEach(() => kuyrugaTemizle());

  it('kuyrukta kalan her kelimeyi kart olarak ekler', () => {
    kuyrugaAl('set1', 'Denemeler', ['alpha', 'beta', 'gamma']);
    const eklenen: { kelime: string; setId: string }[] = [];

    const sayi = kalanlariBosEkle((k, setId) => eklenen.push({ kelime: k.word, setId }));

    expect(sayi).toBe(3);
    expect(eklenen.map(e => e.kelime)).toEqual(['alpha', 'beta', 'gamma']);
    expect(eklenen.every(e => e.setId === 'set1')).toBe(true);
  });

  it('uydurma anlam yazmaz: anlam alanı boş kalır', () => {
    kuyrugaAl('set1', 'Denemeler', ['alpha']);
    const eklenen: WordCard[] = [];

    kalanlariBosEkle(k => eklenen.push(k));

    expect(eklenen[0].turkishMeaning).toBe('');
    expect(eklenen[0].partOfSpeech).toBe('');
    expect(eklenen[0].examples).toEqual([]);
    expect(eklenen[0].isCustom).toBe(true);
  });

  it('kuyruğu kapatır; kelimeler ikinci kez eklenmez', () => {
    kuyrugaAl('set1', 'Denemeler', ['alpha', 'beta']);
    const eklenen: string[] = [];

    kalanlariBosEkle(k => eklenen.push(k.word));
    const ikinci = kalanlariBosEkle(k => eklenen.push(k.word));

    expect(eklenen).toEqual(['alpha', 'beta']);
    expect(ikinci).toBe(0);
    expect(kuyruguOku()).toBeNull();
  });

  it('her kelime KENDİ setine gider', () => {
    kuyrugaAl('set1', 'Bir', ['alpha']);
    kuyrugaAl('set2', 'Iki', ['beta']);
    const eklenen: { kelime: string; setId: string }[] = [];

    kalanlariBosEkle((k, setId) => eklenen.push({ kelime: k.word, setId }));

    expect(eklenen).toEqual([
      { kelime: 'alpha', setId: 'set1' },
      { kelime: 'beta', setId: 'set2' }
    ]);
  });

  it('bir kart eklenemezse kalanlar yine eklenir', () => {
    kuyrugaAl('set1', 'Denemeler', ['alpha', 'beta', 'gamma']);
    const eklenen: string[] = [];

    const sayi = kalanlariBosEkle(k => {
      if (k.word === 'beta') throw new Error('depolama dolu');
      eklenen.push(k.word);
    });

    expect(eklenen).toEqual(['alpha', 'gamma']);
    expect(sayi).toBe(2);
    expect(kuyruguOku()).toBeNull();
  });

  it('kuyruk boşken kart eklemez', () => {
    const eklenen: WordCard[] = [];
    expect(kalanlariBosEkle(k => eklenen.push(k))).toBe(0);
    expect(eklenen).toHaveLength(0);
  });

  it('bosKart her çağrıda ayrı kimlik üretir', () => {
    expect(bosKart('alpha').id).not.toBe(bosKart('alpha').id);
  });
});
