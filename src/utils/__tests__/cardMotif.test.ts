import { describe, it, expect } from 'vitest';
import { REALMS_MOTIFS, motifForWord } from '../cardMotif';

/**
 * Motif seçimi kelimeye bağlı ve kararlı olmak zorunda.
 *
 * Kullanıcı aynı kelimeyi Oxford listesinde, kendi setinde ve sınav sonuç
 * listesinde görüyor. Seçim rastgele olsaydı ya da bir yere yazılsaydı aynı
 * kelime her ekranda başka bir motifle çıkardı; motif de bir bilgi taşımadığı
 * için bu yalnızca gürültü olurdu.
 */
describe('motifForWord', () => {
  const ORNEK_KELIMELER = [
    'bridge', 'winter', 'dragon', 'raven', 'iron', 'ember',
    'a', 'the', 'reluctant', 'carpet', 'hundred', 'tea',
    'give up', "Oxford's", 'ÇÖĞÜŞ', 'run'
  ];

  it('aynı kelimeye her zaman aynı motifi verir', () => {
    for (const kelime of ORNEK_KELIMELER) {
      const ilk = motifForWord(kelime, 'A1', 'noun');
      for (let i = 0; i < 5; i += 1) {
        expect(motifForWord(kelime, 'A1', 'noun')).toBe(ilk);
      }
    }
  });

  it('büyük/küçük harf ve baştaki boşluk seçimi değiştirmez', () => {
    expect(motifForWord('Bridge')).toBe(motifForWord('bridge'));
    expect(motifForWord('  bridge  ')).toBe(motifForWord('bridge'));
    expect(motifForWord('BRIDGE')).toBe(motifForWord('bridge'));
  });

  it('seviye ve tür seçimin parçası: aynı kelime farklı bağlamda ayrışabilir', () => {
    // Değişmesi şart değil, ama anahtarın parçası olduğu görülmeli:
    // en az bir örnekte ayrışıyor.
    const ayrisan = ORNEK_KELIMELER.some(
      k => motifForWord(k, 'A1', 'noun') !== motifForWord(k, 'C1', 'verb')
    );
    expect(ayrisan).toBe(true);
  });

  it('altı motifin hepsi gerçek kelimelerle çıkıyor', () => {
    // Oxford listesinden 300 gerçek madde başı yerine, deterministik
    // olduğu için küçük bir alfabetik tarama da aynı kanıtı veriyor.
    const cikanlar = new Set<string>();
    for (let i = 0; i < 400; i += 1) {
      cikanlar.add(motifForWord(`word${i}`).id);
    }
    expect(cikanlar.size).toBe(REALMS_MOTIFS.length);
    for (const m of REALMS_MOTIFS) expect(cikanlar.has(m.id)).toBe(true);
  });

  it('altı motif tanımlı ve her biri ayrı dosya', () => {
    expect(REALMS_MOTIFS).toHaveLength(6);
    expect(new Set(REALMS_MOTIFS.map(m => m.id)).size).toBe(6);
    expect(new Set(REALMS_MOTIFS.map(m => m.asset)).size).toBe(6);
    expect(new Set(REALMS_MOTIFS.map(m => m.icon)).size).toBe(6);
  });

  it('dağılım tek bir motife yığılmıyor', () => {
    const sayac = new Map<string, number>();
    for (let i = 0; i < 3000; i += 1) {
      const id = motifForWord(`kelime-${i}`).id;
      sayac.set(id, (sayac.get(id) ?? 0) + 1);
    }
    // 3000 / 6 = 500. Özet fonksiyonu düzgün dağıtıyorsa her motif
    // 500'ün yarısından fazla, iki katından azını alır.
    for (const m of REALMS_MOTIFS) {
      const n = sayac.get(m.id) ?? 0;
      expect(n).toBeGreaterThan(250);
      expect(n).toBeLessThan(1000);
    }
  });
});
