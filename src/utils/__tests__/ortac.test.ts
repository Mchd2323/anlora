import { describe, it, expect } from 'vitest';
import { ortacOlabilirMi } from '../lemmatizer';

/*
 * Kullanıcının verdiği örnek: trap = tuzak, trapped = kapana kısılmış,
 * trapping = tuzak kurma. Uygulama bu biçimleri görünce "kök formu
 * kartlaştırmak önerilir" diyordu; "walked" için doğru, "trapped" için
 * yanlış bir öğüt. Bu işlev, öğüdün nerede yumuşatılacağını söylüyor.
 */
describe('ortaç olabilecek biçimler', () => {
  it('-ed ve -ing biçimlerini işaretler', () => {
    for (const w of ['trapped', 'trapping', 'demanding', 'gifted', 'learned', 'boring']) {
      expect(ortacOlabilirMi(w)).toBe(true);
    }
  });

  it('çekimsiz kelimeleri işaretlemez', () => {
    for (const w of ['trap', 'demand', 'gift', 'house', 'quickly']) {
      expect(ortacOlabilirMi(w)).toBe(false);
    }
  });

  /*
   * Kısa kelimeler eleniyor: "bed", "red", "king" gibi kayıtlar -ed/-ing ile
   * bitiyor ama ortaç değil. Uyarıyı onlarda göstermek, uyarının kendisini
   * gürültüye çevirirdi.
   */
  it('kısa kelimelerde uyarı vermez', () => {
    for (const w of ['bed', 'red', 'king', 'ring', 'wing']) {
      expect(ortacOlabilirMi(w)).toBe(false);
    }
  });
});
