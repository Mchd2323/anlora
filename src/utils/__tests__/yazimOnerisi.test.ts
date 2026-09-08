import { describe, it, expect } from 'vitest';
import { duzenlemeUzakligi, oneriTavani, yazimOnerileri } from '../yazimOnerisi';

/*
 * Aday listesi gerçek sözlüğün küçük bir kesiti. Testin amacı listenin
 * büyüklüğü değil, KARARIN doğruluğu: hangi yazım hatası düzeltilir, hangi
 * gerçek kelime rahat bırakılır.
 */
const ADAYLAR = [
  'receive', 'deceive', 'recipe', 'accommodation', 'accommodate', 'account',
  'cat', 'cap', 'car', 'bat', 'separate', 'desperate', 'definitely',
  'necessary', 'because', 'beautiful', 'give up', 'light', 'night', 'right'
];

describe('duzenlemeUzakligi', () => {
  it('yer değiştirmeyi TEK hata sayar', () => {
    // Düz Levenshtein bunu 2 sayar ve gerçek düzeltme elenirdi.
    expect(duzenlemeUzakligi('recieve', 'receive', 2)).toBe(1);
  });

  it('aynı kelimede sıfır döner', () => {
    expect(duzenlemeUzakligi('light', 'light', 2)).toBe(0);
  });

  it('tavanı aşan uzaklıkta erken çıkar', () => {
    expect(duzenlemeUzakligi('petrichor', 'cat', 2)).toBeGreaterThan(2);
  });

  it('ekleme ve silmeyi sayar', () => {
    expect(duzenlemeUzakligi('acommodation', 'accommodation', 2)).toBe(1);
    expect(duzenlemeUzakligi('acomodation', 'accommodation', 2)).toBe(2);
  });
});

describe('oneriTavani', () => {
  it('üç harf ve altında öneri vermez', () => {
    expect(oneriTavani(3)).toBe(0);
    expect(oneriTavani(2)).toBe(0);
  });

  it('kısa kelimede tek, uzun kelimede iki hataya izin verir', () => {
    expect(oneriTavani(5)).toBe(1);
    expect(oneriTavani(9)).toBe(2);
  });
});

describe('yazimOnerileri', () => {
  it('sık yapılan yazım hatasını düzeltir', () => {
    expect(yazimOnerileri('recieve', ADAYLAR)[0]).toBe('receive');
    expect(yazimOnerileri('acomodation', ADAYLAR)[0]).toBe('accommodation');
    expect(yazimOnerileri('seperate', ADAYLAR)[0]).toBe('separate');
  });

  it('listede olmayan GERÇEK kelimeye öneri uydurmaz', () => {
    // Sözlüğümüz İngilizcenin tamamı değil; uzakta bir kelimeyi düzeltme
    // diye dayatmak, doğru yazılmış kelimeyi bozmak olurdu.
    expect(yazimOnerileri('petrichor', ADAYLAR)).toEqual([]);
  });

  it('çok kısa kelimede susar', () => {
    // 'cet' -> cat/cap/car/bat: hepsi eşit derecede olası, yani hiçbiri değil.
    expect(yazimOnerileri('cet', ADAYLAR)).toEqual([]);
  });

  it('kelime listede varsa öneri vermez', () => {
    expect(yazimOnerileri('receive', ADAYLAR)).toEqual([]);
  });

  it('çok kelimeli kalıpları önermez', () => {
    expect(yazimOnerileri('give ups', ADAYLAR)).toEqual([]);
  });

  it('ilk harfi tutan adayı öne alır', () => {
    // 'receive' ile 'deceive' aynı uzaklıkta; kullanıcının bastığı ilk harf
    // daha güvenilir bir ipucu.
    const oneriler = yazimOnerileri('receve', ADAYLAR);
    expect(oneriler[0]).toBe('receive');
  });

  it('limit kadar öneri döndürür', () => {
    expect(yazimOnerileri('nite', ADAYLAR, 2).length).toBeLessThanOrEqual(2);
  });
});
