import { beforeEach, describe, expect, it } from 'vitest';
import {
  ilkiniDusur,
  kuyrugaAl,
  kuyrugaTemizle,
  kuyruguOku,
  settekiKalan
} from '../topluKuyruk';

/*
 * Kuyruk diske yazıyor; her testten önce temizleniyor. Sınanan şey depolama
 * değil, KURALLAR: iş kaybolmuyor mu, iki set birbirine karışıyor mu, boş
 * kuyruk diskte kalıyor mu.
 */
beforeEach(() => {
  kuyrugaTemizle();
});

describe('topluKuyruk', () => {
  it('boşken null döner', () => {
    expect(kuyruguOku()).toBeNull();
  });

  it('kelimeleri sırasıyla saklar', () => {
    kuyrugaAl('set1', 'Deneme', ['alpha', 'beta', 'gamma']);
    const k = kuyruguOku();
    expect(k?.ogeler.map(o => o.kelime)).toEqual(['alpha', 'beta', 'gamma']);
    expect(k?.toplam).toBe(3);
  });

  it('boş ve boşluklu girdileri eler', () => {
    kuyrugaAl('set1', 'Deneme', ['  alpha  ', '', '   ', 'beta']);
    expect(kuyruguOku()?.ogeler.map(o => o.kelime)).toEqual(['alpha', 'beta']);
  });

  it('ikinci çağrı kelimeleri SONA ekler, listeyi değiştirmez', () => {
    kuyrugaAl('set1', 'Deneme', ['alpha']);
    kuyrugaAl('set1', 'Deneme', ['beta']);
    expect(kuyruguOku()?.ogeler.map(o => o.kelime)).toEqual(['alpha', 'beta']);
    expect(kuyruguOku()?.toplam).toBe(2);
  });

  it('farklı setlerin kelimeleri karışmaz', () => {
    // Tek bir "kuyruğun seti" alanı olsaydı ikinci setin kelimeleri
    // BİRİNCİ sete eklenirdi; hedef her öğede ayrı saklanıyor.
    kuyrugaAl('set1', 'Birinci', ['alpha']);
    kuyrugaAl('set2', 'İkinci', ['beta', 'gamma']);
    const k = kuyruguOku()!;
    expect(settekiKalan(k, 'set1')).toBe(1);
    expect(settekiKalan(k, 'set2')).toBe(2);
    expect(k.ogeler.find(o => o.kelime === 'beta')?.setId).toBe('set2');
  });

  it('ilkiniDusur sıradakini bırakır', () => {
    kuyrugaAl('set1', 'Deneme', ['alpha', 'beta']);
    const kalan = ilkiniDusur();
    expect(kalan?.ogeler.map(o => o.kelime)).toEqual(['beta']);
  });

  it('son öğe düşünce kuyruk diskten silinir', () => {
    // Boş kuyruk kalsaydı setin üstündeki "ekleniyor" satırı sonsuza kadar
    // görünürdü.
    kuyrugaAl('set1', 'Deneme', ['alpha']);
    expect(ilkiniDusur()).toBeNull();
    expect(kuyruguOku()).toBeNull();
  });

  it('toplam düşürmeyle azalmaz; ilerleme ondan hesaplanıyor', () => {
    kuyrugaAl('set1', 'Deneme', ['alpha', 'beta', 'gamma']);
    ilkiniDusur();
    const k = kuyruguOku()!;
    expect(k.toplam).toBe(3);
    expect(k.ogeler.length).toBe(2);
  });

  it('settekiKalan null kuyrukta sıfır döner', () => {
    expect(settekiKalan(null, 'set1')).toBe(0);
  });

  it('biten kelimeleri sonucuyla birlikte kaydeder', () => {
    // Ekrandaki "eklendi" listesi bunu okuyor.
    kuyrugaAl('set1', 'Deneme', ['alpha', 'beta', 'gamma']);
    ilkiniDusur('eklendi');
    ilkiniDusur('bos');
    const k = kuyruguOku()!;
    expect(k.bitenler).toEqual([
      { kelime: 'alpha', durum: 'eklendi' },
      { kelime: 'beta', durum: 'bos' }
    ]);
  });

  it('varsayılan sonuç "eklendi"', () => {
    kuyrugaAl('set1', 'Deneme', ['alpha', 'beta']);
    ilkiniDusur();
    expect(kuyruguOku()?.bitenler[0].durum).toBe('eklendi');
  });

  it('bitenler listesi kuyrukla birlikte siliniyor', () => {
    /*
     * Kuyruk boşalınca kayıt tamamen gidiyor; "eklendi" listesi de onunla
     * birlikte. Kalsaydı hatırlatma satırı bitmiş bir işi göstermeye devam
     * ederdi -- kullanıcının istediği tam tersi: bitince kalksın.
     */
    kuyrugaAl('set1', 'Deneme', ['alpha']);
    expect(ilkiniDusur('eklendi')).toBeNull();
    expect(kuyruguOku()).toBeNull();
  });
});
