import React from 'react';
import { describe, it, expect } from 'vitest';
import { setPaletteId, setRengi, setUzeri, setZemin, setDegiskenleri, SET_RENKLERI } from '../setColors';
import { SET_RENK_KIMLIKLERI } from '../setPalette';
import { VARSAYILAN_SET_RENGI } from '../setColors';

/**
 * Set rengi artık hex değil paletteId olarak saklanıyor. Kullanıcıların
 * setlerinde ESKİ kimlikler kayıtlı; bu testler hiçbirinin kaybolmadığını
 * ve rengin CSS belirtecine bağlandığını doğruluyor.
 */
describe('set renkleri', () => {
  it('kutucuklar paletteki kimliklerle birebir aynı', () => {
    // Sayı sabitlenmiyor: palet sekizden on ikiye çıktı (dört açık ton
    // eklendi) ve bundan sonra da değişebilir. Sabitlenen şey, seçicinin
    // paletten SAPMAMASI — eksik ya da fazla kutucuk olmaması.
    expect(SET_RENKLERI.map(r => r.id)).toEqual([...SET_RENK_KIMLIKLERI]);
    expect(SET_RENKLERI.length).toBeGreaterThanOrEqual(8);
  });

  it('eski altı renk kimliği karşılığına eşleniyor, hiçbiri kaybolmuyor', () => {
    expect(setPaletteId('indigo')).toBe('kuzgun-haritasi');
    expect(setPaletteId('teal')).toBe('buz-kalesi');
    expect(setPaletteId('emerald')).toBe('orman-nobeti');
    expect(setPaletteId('amber')).toBe('tacli-parsomen');
    expect(setPaletteId('rose')).toBe('kizil-kale');
    expect(setPaletteId('slate')).toBe('demir-gece');
  });

  it('yeni kimlikler olduğu gibi kalıyor', () => {
    for (const id of SET_RENK_KIMLIKLERI) expect(setPaletteId(id)).toBe(id);
  });

  it('boş ya da tanınmayan kimlik varsayılana düşüyor, set renksiz kalmıyor', () => {
    expect(setPaletteId()).toBe(VARSAYILAN_SET_RENGI);
    expect(setPaletteId('')).toBe(VARSAYILAN_SET_RENGI);
    expect(setPaletteId('olmayan-renk')).toBe(VARSAYILAN_SET_RENGI);
  });

  it('renk hex olarak değil CSS belirteci olarak dönüyor', () => {
    // Tema değişince aynı setin açık/koyu karşılığına geçmesi buna bağlı.
    expect(setRengi('amber')).toBe('var(--set-tacli-parsomen)');
    expect(setRengi('buz-kalesi')).toBe('var(--set-buz-kalesi)');
    expect(setRengi()).toBe(`var(--set-${VARSAYILAN_SET_RENGI})`);
    for (const r of SET_RENKLERI) expect(r.hex).toMatch(/^var\(--set-[a-z-]+\)$/);
  });

  /*
   * Simge rengi ölçülerek üretiliyor ve her kutucuk kendi belirtecini
   * taşımak zorunda. Bileşenlerde `text-white` sabitken koyu temada
   * rozetlerin sekizinde de simge kayboluyordu (kontrast 1,37 – 2,15);
   * bu testler o sabitin geri gelmemesini bekliyor.
   */
  it('her renk kendi simge ve zemin belirtecini taşıyor', () => {
    for (const r of SET_RENKLERI) {
      expect(r.uzeri).toBe(`var(--set-${r.id}-uzeri)`);
    }
    expect(setUzeri('amber')).toBe('var(--set-tacli-parsomen-uzeri)');
    expect(setZemin('amber')).toBe('var(--set-tacli-parsomen-zemin)');
    expect(setUzeri()).toBe(`var(--set-${VARSAYILAN_SET_RENGI}-uzeri)`);
  });

  it('kart üç belirtecin üçünü birden yazıyor', () => {
    // Biri eksik kalırsa simge beyaz kalır ya da gövde tonlanmaz.
    expect(setDegiskenleri('buz-kalesi')).toEqual({
      '--hanedan': 'var(--set-buz-kalesi)',
      '--hanedan-uzeri': 'var(--set-buz-kalesi-uzeri)',
      '--hanedan-zemin': 'var(--set-buz-kalesi-zemin)'
    });
    expect(setDegiskenleri('indigo')['--hanedan' as keyof React.CSSProperties])
      .toBe('var(--set-kuzgun-haritasi)');
  });
});
