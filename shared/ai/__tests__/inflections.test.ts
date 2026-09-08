import { describe, it, expect } from 'vitest';
import { cumledeGeciyorMu } from '../inflections';
import { validateGeneratedWordCard } from '../validation';

/**
 * ÖRNEK CÜMLE KELİMEYİ İÇERİYOR MU?
 *
 * Doğrulayıcı bunu düz alt dize aramasıyla soruyordu ve düzensiz fiillerin
 * TAMAMI o kapıya çarpıyordu: "run" için "She ran a marathon" reddediliyor,
 * kart baştan ürettiriliyor (süre iki katı), ikinci deneme de aynı sebeple
 * düşüyor ve kullanıcı "kelime bilgileri oluşturulamadı" görüyordu.
 */
describe('çekimli biçimler kelime sayılır', () => {
  it('düzensiz fiiller: ran, went, bought, saw, took', () => {
    expect(cumledeGeciyorMu('She ran a marathon last spring.', 'run')).toBe(true);
    expect(cumledeGeciyorMu('He went home early.', 'go')).toBe(true);
    expect(cumledeGeciyorMu('They bought a new car.', 'buy')).toBe(true);
    expect(cumledeGeciyorMu('I saw her at the station.', 'see')).toBe(true);
    expect(cumledeGeciyorMu('She took the train.', 'take')).toBe(true);
  });

  it('düzenli çekimler: -s, -ed, -ing, ünsüz ikizleşmesi, y -> ies', () => {
    expect(cumledeGeciyorMu('He walks to work.', 'walk')).toBe(true);
    expect(cumledeGeciyorMu('They stopped the car.', 'stop')).toBe(true);
    expect(cumledeGeciyorMu('She is running late.', 'run')).toBe(true);
    expect(cumledeGeciyorMu('He carries the box.', 'carry')).toBe(true);
    expect(cumledeGeciyorMu('We are making dinner.', 'make')).toBe(true);
  });

  it('kelimenin kendisi de elbette geçer', () => {
    expect(cumledeGeciyorMu('The petrichor filled the air.', 'petrichor')).toBe(true);
  });

  it('kalıplar olduğu gibi aranır', () => {
    expect(cumledeGeciyorMu('Do not give up so easily.', 'give up')).toBe(true);
    expect(cumledeGeciyorMu('She was very calm.', 'give up')).toBe(false);
  });

  /**
   * KAPI GEVŞEMİYOR. Değişen tek şey çekimli biçimlerin sayılması; alakasız
   * bir cümle ve kelimeyi yalnızca İÇİNDE barındıran daha uzun bir sözcük
   * hâlâ reddediliyor.
   */
  it('alakasız cümle ve gömülü harf dizisi reddedilir', () => {
    expect(cumledeGeciyorMu('The weather is nice today.', 'run')).toBe(false);
    expect(cumledeGeciyorMu('We must concatenate the files.', 'cat')).toBe(false);
    expect(cumledeGeciyorMu('He is a carpenter.', 'car')).toBe(false);
  });
});

describe('doğrulayıcı düzensiz fiilli kartı artık kabul ediyor', () => {
  const kart = (ornek: string) => ({
    word: 'run',
    turkishMeaning: 'koşmak',
    senses: [{ turkishMeanings: ['koşmak'], examples: [{ en: ornek, tr: 'Koştu.' }] }],
    examples: [{ en: ornek, tr: 'Koştu.' }]
  });

  it('"She ran a marathon" artık geçiyor', () => {
    expect(validateGeneratedWordCard(kart('She ran a marathon.'), 'run')).toBe(true);
  });

  it('kelimeyi hiç geçirmeyen örnek yine reddediliyor', () => {
    expect(validateGeneratedWordCard(kart('The weather is nice.'), 'run')).toBe(false);
  });
});
