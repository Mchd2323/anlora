import { describe, it, expect } from 'vitest';
import { setPaletteId, setRengi, SET_RENKLERI } from '../setColors';
import { SET_RENK_KIMLIKLERI } from '../setPalette';
import { VARSAYILAN_SET_RENGI } from '../setColors';

/**
 * Set rengi artık hex değil paletteId olarak saklanıyor. Kullanıcıların
 * setlerinde ESKİ kimlikler kayıtlı; bu testler hiçbirinin kaybolmadığını
 * ve rengin CSS belirtecine bağlandığını doğruluyor.
 */
describe('set renkleri', () => {
  it('sekiz kutucuk, hepsi paletteki kimliklerle aynı', () => {
    expect(SET_RENKLERI).toHaveLength(8);
    expect(SET_RENKLERI.map(r => r.id)).toEqual([...SET_RENK_KIMLIKLERI]);
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
});
