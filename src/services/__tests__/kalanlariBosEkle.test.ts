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

    const sayi = kalanlariBosEkle((k, setId) => { eklenen.push({ kelime: k.word, setId }); return true; });

    expect(sayi).toBe(3);
    expect(eklenen.map(e => e.kelime)).toEqual(['alpha', 'beta', 'gamma']);
    expect(eklenen.every(e => e.setId === 'set1')).toBe(true);
  });

  it('uydurma anlam yazmaz: anlam alanı boş kalır', () => {
    kuyrugaAl('set1', 'Denemeler', ['alpha']);
    const eklenen: WordCard[] = [];

    kalanlariBosEkle(k => { eklenen.push(k); return true; });

    expect(eklenen[0].turkishMeaning).toBe('');
    expect(eklenen[0].partOfSpeech).toBe('');
    expect(eklenen[0].examples).toEqual([]);
    expect(eklenen[0].isCustom).toBe(true);
  });

  it('kuyruğu kapatır; kelimeler ikinci kez eklenmez', () => {
    kuyrugaAl('set1', 'Denemeler', ['alpha', 'beta']);
    const eklenen: string[] = [];

    kalanlariBosEkle(k => { eklenen.push(k.word); return true; });
    const ikinci = kalanlariBosEkle(k => { eklenen.push(k.word); return true; });

    expect(eklenen).toEqual(['alpha', 'beta']);
    expect(ikinci).toBe(0);
    expect(kuyruguOku()).toBeNull();
  });

  it('her kelime KENDİ setine gider', () => {
    kuyrugaAl('set1', 'Bir', ['alpha']);
    kuyrugaAl('set2', 'Iki', ['beta']);
    const eklenen: { kelime: string; setId: string }[] = [];

    kalanlariBosEkle((k, setId) => { eklenen.push({ kelime: k.word, setId }); return true; });

    expect(eklenen).toEqual([
      { kelime: 'alpha', setId: 'set1' },
      { kelime: 'beta', setId: 'set2' }
    ]);
  });

  it('bir kart eklenemezse kalanlar yine eklenir, KUYRUK KORUNUR', () => {
    kuyrugaAl('set1', 'Denemeler', ['alpha', 'beta', 'gamma']);
    const eklenen: string[] = [];

    const sayi = kalanlariBosEkle(k => {
      if (k.word === 'beta') throw new Error('depolama dolu');
      eklenen.push(k.word);
      return true;
    });

    expect(eklenen).toEqual(['alpha', 'gamma']);
    expect(sayi).toBe(2);
    // DAVRANIŞ DEĞİŞTİ: burada kuyruğun silinmesi bekleniyordu. Bir kart
    // düştüğünde kuyruğu silmek, o kelimenin tek kalıcı kaydını yok etmek
    // demekti. Artık kuyruk duruyor; sonraki açılışta yeniden denenir.
    expect(kuyruguOku()).not.toBeNull();
  });

  /*
   * ASIL TUZAK: `ekle` FIRLATMADAN başarısız olur.
   *
   * Zincir `safeStorage.writeJSON`e varıyor ve o, kota dolduğunda hata
   * fırlatmıyor -- sessizce `false` dönüp kartı yalnızca bellekte tutuyor.
   * Eski kod bunu "eklendi" sayıp kuyruğu siliyordu: altmış yedi kelimenin
   * hiçbiri diske düşmemiş, tek kalıcı kayıt da yok edilmiş oluyordu.
   */
  it('kart diske düşmezse sayılmaz ve kuyruk silinmez', () => {
    kuyrugaAl('set1', 'Denemeler', ['alpha', 'beta']);
    const denenen: string[] = [];

    const sayi = kalanlariBosEkle(k => {
      denenen.push(k.word);
      return false; // kota dolu: bellekte kaldı, diske düşmedi
    });

    expect(denenen).toEqual(['alpha', 'beta']);
    expect(sayi).toBe(0);
    expect(kuyruguOku()).not.toBeNull();

    // Yer açılınca aynı kelimeler yeniden denenebiliyor.
    const ikinci = kalanlariBosEkle(() => true);
    expect(ikinci).toBe(2);
    expect(kuyruguOku()).toBeNull();
  });

  it('kuyruk boşken kart eklemez', () => {
    const eklenen: WordCard[] = [];
    expect(kalanlariBosEkle(k => { eklenen.push(k); return true; })).toBe(0);
    expect(eklenen).toHaveLength(0);
  });

  it('bosKart her çağrıda ayrı kimlik üretir', () => {
    expect(bosKart('alpha').id).not.toBe(bosKart('alpha').id);
  });
});
