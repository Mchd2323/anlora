import { describe, it, expect } from 'vitest';
import { setPaletteId, setRengi, SET_RENKLERI } from '../setColors';
import { AILE_KIMLIKLERI, VARSAYILAN_AILE } from '../realmsFamilies';

/**
 * Set rengi artık hex değil paletteId olarak saklanıyor. Kullanıcıların
 * setlerinde ESKİ kimlikler kayıtlı; bu testler hiçbirinin kaybolmadığını
 * ve rengin CSS belirtecine bağlandığını doğruluyor.
 */
describe('set renkleri', () => {
  it('sekiz kutucuk, hepsi tema aileleriyle aynı kimlikte', () => {
    expect(SET_RENKLERI).toHaveLength(8);
    expect(SET_RENKLERI.map(r => r.id)).toEqual([...AILE_KIMLIKLERI]);
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
    for (const id of AILE_KIMLIKLERI) expect(setPaletteId(id)).toBe(id);
  });

  it('boş ya da tanınmayan kimlik varsayılana düşüyor, set renksiz kalmıyor', () => {
    expect(setPaletteId()).toBe(VARSAYILAN_AILE);
    expect(setPaletteId('')).toBe(VARSAYILAN_AILE);
    expect(setPaletteId('olmayan-renk')).toBe(VARSAYILAN_AILE);
  });

  it('renk hex olarak değil CSS belirteci olarak dönüyor', () => {
    // Tema değişince aynı setin açık/koyu karşılığına geçmesi buna bağlı.
    expect(setRengi('amber')).toBe('var(--set-tacli-parsomen)');
    expect(setRengi('buz-kalesi')).toBe('var(--set-buz-kalesi)');
    expect(setRengi()).toBe(`var(--set-${VARSAYILAN_AILE})`);
    for (const r of SET_RENKLERI) expect(r.hex).toMatch(/^var\(--set-[a-z-]+\)$/);
  });
});
