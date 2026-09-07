import { describe, expect, it } from 'vitest';
import { validateGeneratedWordCard } from '../validation';

/**
 * Bu denetim sözlüğe uydurma içerik girmesini engelleyen son kapı.
 *
 * Neden test edilmesi gerekiyor: aynı işlev iki ayrı çalışma ortamından
 * çağrılıyor (Express sunucusu ve Cloudflare Worker). Ortak dosyaya
 * taşındığında davranışının değişmediğini gösteren bir kanıt olmadan,
 * taşımanın kendisi sessiz bir gerileme olabilirdi.
 */

function gecerliKart(overrides: Record<string, unknown> = {}) {
  return {
    word: 'light',
    turkishMeaning: 'ışık, hafif',
    examples: [
      { en: 'She turned on the light.', tr: 'Işığı açtı.' },
      { en: 'The bag is very light.', tr: 'Çanta çok hafif.' },
    ],
    ...overrides,
  };
}

describe('validateGeneratedWordCard', () => {
  it('düzgün bir kartı kabul eder', () => {
    expect(validateGeneratedWordCard(gecerliKart(), 'light')).toBe(true);
  });

  it('Türkçe anlamı olmayan kartı reddeder', () => {
    expect(
      validateGeneratedWordCard(gecerliKart({ turkishMeaning: '   ' }), 'light')
    ).toBe(false);
  });

  it('anlam olarak İngilizce kelimenin kendisini yazan kartı reddeder', () => {
    expect(
      validateGeneratedWordCard(
        gecerliKart({ word: 'light', turkishMeaning: 'light' }),
        'light'
      )
    ).toBe(false);
  });

  it('Türkçeye yerleşmiş alıntı sözcüklerde aynılığa izin verir', () => {
    const kart = {
      word: 'internet',
      turkishMeaning: 'internet',
      examples: [{ en: 'The internet is slow today.', tr: 'İnternet bugün yavaş.' }],
    };
    expect(validateGeneratedWordCard(kart, 'internet')).toBe(true);
  });

  it('şablon cümle üreten kartı reddeder', () => {
    const kart = gecerliKart({
      examples: [
        {
          en: 'I want to light today because it is very important.',
          tr: 'Bugün ışık yapmak istiyorum çünkü çok önemli.',
        },
      ],
    });
    expect(validateGeneratedWordCard(kart, 'light')).toBe(false);
  });

  it('hedef kelimeyi içermeyen örneği reddeder', () => {
    const kart = gecerliKart({
      examples: [{ en: 'The room was very dark.', tr: 'Oda çok karanlıktı.' }],
    });
    expect(validateGeneratedWordCard(kart, 'light')).toBe(false);
  });

  it('örneği hiç olmayan kartı reddeder', () => {
    expect(validateGeneratedWordCard(gecerliKart({ examples: [] }), 'light')).toBe(false);
  });

  it('"kelimesi" gibi doldurma anlamları reddeder', () => {
    expect(
      validateGeneratedWordCard(
        gecerliKart({ turkishMeaning: 'light kelimesi' }),
        'light'
      )
    ).toBe(false);
  });

  it('anlamı boş bir sense taşıyan kartı reddeder', () => {
    const kart = gecerliKart({
      senses: [{ partOfSpeech: 'n.', turkishMeanings: [], examples: [] }],
    });
    expect(validateGeneratedWordCard(kart, 'light')).toBe(false);
  });
});
