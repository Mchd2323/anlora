import { describe, it, expect, beforeEach } from 'vitest';
import { eskiKuyrugaTakilanlariKurtar } from '../eskiKuyrukGocu';
import { kuyrugaAl, kuyrugaTemizle, kuyruguOku } from '../topluKuyruk';
import type { WordCard } from '../../types';

/**
 * ESKİ KUYRUKTA TAKILI KALANLAR KAYBOLMASIN.
 *
 * Toplu eklemede yapay zekâ kaldırıldı ve arka plan kuyruğu da onunla
 * birlikte kalktı. Ama kuyruk kullanıcının telefonunda DİSKTE duruyor
 * olabilir: bu sürümden önce başlatılmış, yarım kalmış bir liste. İşleyen
 * kod artık olmadığı için o kelimeler hiçbir zaman eklenmez ve kullanıcı
 * bunu göremez.
 *
 * Yaşandı: kullanıcının kuyruğunda altmış yedi kelime "0 hazır · 57
 * bekliyor" diye takılı kalmıştı.
 */
describe('eskiKuyrugaTakilanlariKurtar', () => {
  beforeEach(() => kuyrugaTemizle());

  it('kuyrukta kalan kelimeleri kart olarak kurtarır', () => {
    kuyrugaAl('set1', 'Deneme', ['alpha', 'beta', 'gamma']);
    const eklenen: { kelime: string; setId: string }[] = [];

    const sayi = eskiKuyrugaTakilanlariKurtar((k, setId) =>
      eklenen.push({ kelime: k.word, setId })
    );

    expect(sayi).toBe(3);
    expect(eklenen.map(e => e.kelime)).toEqual(['alpha', 'beta', 'gamma']);
    expect(kuyruguOku()).toBeNull();
  });

  it('kurtarılan kartta uydurma anlam yoktur', () => {
    kuyrugaAl('set1', 'Deneme', ['alpha']);
    const eklenen: WordCard[] = [];

    eskiKuyrugaTakilanlariKurtar(k => eklenen.push(k));

    expect(eklenen[0].turkishMeaning).toBe('');
    expect(eklenen[0].examples).toEqual([]);
    expect(eklenen[0].word).toBe('alpha');
  });

  it('kuyruk yoksa hiçbir şey yapmaz', () => {
    const eklenen: WordCard[] = [];
    expect(eskiKuyrugaTakilanlariKurtar(k => eklenen.push(k))).toBe(0);
    expect(eklenen).toHaveLength(0);
  });

  it('ikinci açılışta yapacak iş bulmaz', () => {
    kuyrugaAl('set1', 'Deneme', ['alpha', 'beta']);
    const eklenen: WordCard[] = [];

    eskiKuyrugaTakilanlariKurtar(k => eklenen.push(k));
    const ikinci = eskiKuyrugaTakilanlariKurtar(k => eklenen.push(k));

    expect(eklenen).toHaveLength(2);
    expect(ikinci).toBe(0);
  });

  it('her kelime KENDİ setine gider', () => {
    kuyrugaAl('set1', 'Bir', ['alpha']);
    kuyrugaAl('set2', 'Iki', ['beta']);
    const eklenen: { kelime: string; setId: string }[] = [];

    eskiKuyrugaTakilanlariKurtar((k, setId) => eklenen.push({ kelime: k.word, setId }));

    expect(eklenen).toEqual([
      { kelime: 'alpha', setId: 'set1' },
      { kelime: 'beta', setId: 'set2' }
    ]);
  });
});
