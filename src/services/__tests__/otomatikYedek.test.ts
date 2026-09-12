import { describe, it, expect } from 'vitest';
import { yedekGerekliMi, silinecekler, YEDEK_ARALIGI_MS } from '../otomatikYedek';

/*
 * Kullanıcı bir güncellemeden sonra bütün verisini kaybetti. Elle yedek alma
 * özelliği vardı ama alınmamış bir yedek yok hükmündedir; bu yüzden yedek
 * kendiliğinden alınıyor. Buradaki testler, özelliğin KENDİ KENDİNİ
 * baltalamamasını sabitliyor.
 */
describe('otomatik yedek kararı', () => {
  const simdi = Date.parse('2026-09-12T12:00:00.000Z');

  it('hiç yedek alınmadıysa alınır', () => {
    expect(yedekGerekliMi(null, simdi, true)).toBe(true);
  });

  it('aralık dolmadan tekrar alınmaz', () => {
    const birSaatOnce = new Date(simdi - 60 * 60 * 1000).toISOString();
    expect(yedekGerekliMi(birSaatOnce, simdi, true)).toBe(false);
  });

  it('aralık dolunca alınır', () => {
    const eski = new Date(simdi - YEDEK_ARALIGI_MS - 1000).toISOString();
    expect(yedekGerekliMi(eski, simdi, true)).toBe(true);
  });

  /*
   * EN ÖNEMLİ KURAL. Veri kaybından sonra açılan uygulama boş durumu
   * yedekleseydi, kurtarma dosyasının üzerine boş bir kopya yazılır ve
   * kullanıcının son şansı da yok olurdu.
   */
  it('ortada veri yoksa ASLA yedeklenmez', () => {
    expect(yedekGerekliMi(null, simdi, false)).toBe(false);
    const eski = new Date(simdi - YEDEK_ARALIGI_MS - 1000).toISOString();
    expect(yedekGerekliMi(eski, simdi, false)).toBe(false);
  });

  it('bozuk damga yedeği engellemez', () => {
    expect(yedekGerekliMi('bu bir tarih değil', simdi, true)).toBe(true);
  });
});

describe('eski kopyaların temizliği', () => {
  it('en yeni üç dosya korunur', () => {
    const dosyalar = [
      'anlora_otomatik_yedek_2026-09-08_09.json',
      'anlora_otomatik_yedek_2026-09-09_09.json',
      'anlora_otomatik_yedek_2026-09-10_09.json',
      'anlora_otomatik_yedek_2026-09-11_09.json',
      'anlora_otomatik_yedek_2026-09-12_09.json'
    ];
    expect(silinecekler(dosyalar)).toEqual([
      'anlora_otomatik_yedek_2026-09-08_09.json',
      'anlora_otomatik_yedek_2026-09-09_09.json'
    ]);
  });

  it('kullanıcının kendi dosyalarına dokunmaz', () => {
    const dosyalar = [
      'anlora_yedek_2026-09-01.json',
      'fotoğraf.jpg',
      'anlora_otomatik_yedek_2026-09-12_09.json'
    ];
    expect(silinecekler(dosyalar)).toEqual([]);
  });
});
