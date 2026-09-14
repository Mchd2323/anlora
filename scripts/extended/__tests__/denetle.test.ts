import { describe, it, expect } from 'vitest';

// Beklemeyi kapat: sınanan şey davranış, bekleme süresi değil. Modül
// yüklenmeden ÖNCE ayarlanmalı, sabit yükleme anında okunuyor.
process.env.ANLORA_TUR_BEKLEME_MS = '0';
const { denetle } = await import('../uret_icerik');

/**
 * DENETİM YAPILAMAYINCA ÜRETİLEN İÇERİK ATILMASIN.
 *
 * Bant 9'un ilk koşusunda 2.170 anlamlık işten pakete 91 anlam girdi.
 * Sebep üretim hatası değildi: denetim turu kotaya takılıp yanıt alamayınca
 * kod o partinin TAMAMINI reddediyordu ve 1.185 sağlam kayıt çöpe gitti.
 *
 * Denetim ikinci ağdır; birincil kapı `sorunlar()` ve `build_bands.py
 * --strict`. İkinci ağın kurulamaması, balığı geri atmak için sebep değil.
 * Buradaki testler bu ayrımı sabitliyor.
 */

const kayit = (id: string) => ({
  id,
  word: id,
  pos: 'n.',
  tanimlar: ['a test word'],
  anlamlar: ['deneme']
});

/** Her istekte verilen yanıtı döndüren sahte istemci. */
function sahteAi(yanitlar: (string | null)[]) {
  let i = 0;
  return {
    models: {
      generateContent: async () => {
        const y = yanitlar[Math.min(i++, yanitlar.length - 1)];
        if (y === null) throw new Error('429 kota');
        return { text: y };
      }
    }
  };
}

describe('denetle', () => {
  it('model yanıt vermezse kayıtları REDDETMEZ, denetlenemeyen sayar', async () => {
    const kayitlar = [kayit('a'), kayit('b'), kayit('c')];
    const { red, denetlenemeyen } = await denetle(sahteAi([null]), kayitlar, { idx: 0 });

    expect(red.size).toBe(0);
    expect([...denetlenemeyen].sort()).toEqual(['a', 'b', 'c']);
  });

  it('gerçek sorunu reddeder', async () => {
    const yanit = JSON.stringify([{ id: 'b', sebep: 'karşılık tanıma uymuyor' }]);
    const { red, denetlenemeyen } = await denetle(
      sahteAi([yanit]), [kayit('a'), kayit('b')], { idx: 0 }
    );

    expect([...red.keys()]).toEqual(['b']);
    expect(red.get('b')).toContain('uymuyor');
    expect(denetlenemeyen.size).toBe(0);
  });

  it('sorun yoksa hiçbirini elemez', async () => {
    const { red, denetlenemeyen } = await denetle(
      sahteAi(['[]']), [kayit('a'), kayit('b')], { idx: 0 }
    );

    expect(red.size).toBe(0);
    expect(denetlenemeyen.size).toBe(0);
  });

  it('yanıttaki tanımadığı kimliği yok sayar', async () => {
    const yanit = JSON.stringify([
      { id: 'a', sebep: 'gerçek sorun' },
      { id: 'baska-partiden', sebep: 'bu grupta yok' }
    ]);
    const { red } = await denetle(sahteAi([yanit]), [kayit('a')], { idx: 0 });

    expect([...red.keys()]).toEqual(['a']);
  });

  it('sebep yazılmamışsa varsayılan sebep koyar', async () => {
    const yanit = JSON.stringify([{ id: 'a' }]);
    const { red } = await denetle(sahteAi([yanit]), [kayit('a')], { idx: 0 });

    expect(red.get('a')).toBeTruthy();
  });
});
