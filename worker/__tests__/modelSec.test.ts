import { describe, expect, it } from 'vitest';
import { modelSec } from '../src/index';

/**
 * Model seçimi.
 *
 * Bu işlev, dağıtımı ilk denemede kıran kararın yerine geçti: sabit yazılmış
 * `gemini-2.5-flash` adı Gemini'de 404 verdi. Artık ad tahmin edilmiyor,
 * API'nin bildirdiği liste arasından seçiliyor; sıranın kayması sessizce
 * pahalı ya da erişilemez bir modele düşmek demek olurdu.
 */
describe('modelSec', () => {
  it('tercih edilen adı varsa onu seçer', () => {
    expect(
      modelSec(['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'])
    ).toBe('gemini-2.5-flash');
  });

  it('tercih edilen ad yoksa bir flash modeline düşer', () => {
    expect(modelSec(['gemini-2.5-pro', 'gemini-2.0-flash'])).toBe('gemini-2.0-flash');
  });

  it('düşünme kipli flash modelini seçmez', () => {
    expect(
      modelSec(['gemini-2.0-flash-thinking', 'gemini-flash-latest'])
    ).toBe('gemini-flash-latest');
  });

  it('flash yoksa listedeki ilkini alır', () => {
    expect(modelSec(['gemini-2.5-pro', 'gemma-3'])).toBe('gemini-2.5-pro');
  });
});
