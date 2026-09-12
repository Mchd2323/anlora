import { describe, it, expect } from 'vitest';
import { yeniDagilimi, dagilimMetni } from '../topluDagilim';

/*
 * Kullanıcı 250 kelimelik listeden doksanının "sözlükte yok" çıkmasına
 * bakıp sözlüğün eksik olduğundan şüphelendi. Ölçüm sözlüğün dolu olduğunu
 * gösterdi; sorun listenin kalıp ağırlıklı olmasıydı. Bu döküm, aynı sorunun
 * her listede kullanıcı tarafından görülebilmesi için.
 */
describe('sözlükte bulunamayanların dökümü', () => {
  const liste = [
    { status: 'NEW', cokKelimeli: true }, // split second
    { status: 'NEW', cokKelimeli: true }, // mass production
    { status: 'NEW', yazimOnerisi: ['branch'] }, // branche
    { status: 'NEW', kokBicimi: 'suburb' }, // suburbs
    { status: 'NEW' }, // ox
    { status: 'EXACT_IN_OXFORD' }, // thrive
    { status: 'SOZLUKTE' }, // in advance
    { status: 'LISTEDE_TEKRAR' }
  ];

  it('yalnızca sözlükte bulunamayanları sayar', () => {
    expect(yeniDagilimi(liste).toplam).toBe(5);
  });

  it('her girdi tam olarak bir kovaya düşer', () => {
    const d = yeniDagilimi(liste);
    expect(d.cokSozcuklu + d.yazimSupheli + d.cekimli + d.tekSozcuk).toBe(d.toplam);
    expect(d).toMatchObject({ cokSozcuklu: 2, yazimSupheli: 1, cekimli: 1, tekSozcuk: 1 });
  });

  /*
   * Çok sözcüklü olmak yazım şüphesinden ÖNCE geliyor: "day off" girdisine
   * "payoff" önerisi verilmesi zaten hatalıydı, dökümde de o girdi yazım
   * hatası gibi görünmemeli.
   */
  it('çok sözcüklü girdi yazım şüphelisi sayılmaz', () => {
    const d = yeniDagilimi([{ status: 'NEW', cokKelimeli: true, yazimOnerisi: ['payoff'] }]);
    expect(d).toMatchObject({ cokSozcuklu: 1, yazimSupheli: 0 });
  });

  it('boş liste sıfır döner', () => {
    expect(yeniDagilimi([])).toMatchObject({ toplam: 0, tekSozcuk: 0 });
  });

  it('metin yalnızca dolu kovaları yazar', () => {
    expect(dagilimMetni(yeniDagilimi(liste))).toBe(
      '2 tanesi çok sözcüklü kalıp, 1 tanesi yazım şüpheli, 1 tanesi çekimli biçim, 1 tanesi tek sözcük'
    );
    expect(dagilimMetni(yeniDagilimi([{ status: 'NEW', cokKelimeli: true }]))).toBe(
      '1 tanesi çok sözcüklü kalıp'
    );
  });
});
