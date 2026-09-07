import { describe, expect, it } from 'vitest';
import { modelAdaylari } from '../src/index';

/**
 * Model aday sırası.
 *
 * Bu sıra, dağıtımı iki kez kıran kararın yerine geçti. Önce sabit yazılmış
 * `gemini-2.5-flash` 404 verdi; sonra aynı ad LİSTEDE göründüğü için yeniden
 * seçildi ve yine 404 verdi — Gemini "artık yeni kullanıcılara açık değil"
 * diyordu. Yani listede olmak çağrılabilir olmak demek değil.
 *
 * Sıranın kayması sessizce görüntü/ses modeline ya da emekli bir sürüme
 * düşmek demek olurdu; bu yüzden sıra sınanıyor.
 */

// Kullanıcının anahtarının gerçekten döndürdüğü liste.
const GERCEK_LISTE = [
  'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-preview-tts',
  'gemma-4-26b-a4b-it', 'gemini-flash-latest', 'gemini-flash-lite-latest',
  'gemini-pro-latest', 'gemini-2.5-flash-lite', 'gemini-2.5-flash-image',
  'gemini-3-flash-preview', 'gemini-3.1-pro-preview', 'gemini-3.5-flash',
  'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.8-flash',
  'lyria-3.5', 'gemini-3.5-transcribe', 'nano-banana-pro-preview',
  'deep-research-max-preview-04-2026', 'gemini-2.5-computer-use-preview-10-2025',
];

describe('modelAdaylari', () => {
  it('takma adı en başa koyar', () => {
    expect(modelAdaylari(GERCEK_LISTE)[0]).toBe('gemini-flash-latest');
  });

  it('takma ad yoksa en yüksek sürümlü kararlı flash modelini seçer', () => {
    const liste = GERCEK_LISTE.filter(ad => ad !== 'gemini-flash-latest');
    expect(modelAdaylari(liste)[0]).toBe('gemini-3.8-flash');
  });

  it('görüntü, ses ve araştırma modellerini tamamen eler', () => {
    const sonuc = modelAdaylari(GERCEK_LISTE);
    for (const kotu of ['image', 'tts', 'transcribe', 'lyria', 'nano-banana',
                        'deep-research', 'computer-use', 'gemma']) {
      expect(sonuc.some(ad => ad.includes(kotu))).toBe(false);
    }
  });

  it('emekli 2.5-flash ilk dört adayın içine girmez', () => {
    // Asıl hata buydu: listede vardı, seçildi, 404 verdi.
    expect(modelAdaylari(GERCEK_LISTE).slice(0, 4)).not.toContain('gemini-2.5-flash');
  });

  it('kararlı modeli önizlemeye tercih eder', () => {
    const sira = modelAdaylari(['gemini-3-flash-preview', 'gemini-3.5-flash']);
    expect(sira[0]).toBe('gemini-3.5-flash');
  });

  it('hepsi elenirse boş liste yerine ham listeyi döndürür', () => {
    expect(modelAdaylari(['lyria-3.5', 'nano-banana-pro-preview'])).toHaveLength(2);
  });

  it('tek aday varsa onu döndürür', () => {
    expect(modelAdaylari(['gemini-3.8-flash'])).toEqual(['gemini-3.8-flash']);
  });
});
