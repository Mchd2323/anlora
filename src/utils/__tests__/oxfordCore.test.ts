import { describe, it, expect, beforeAll } from 'vitest';
import {
  oxfordCoreRepository,
  loadOxfordCore,
  OXFORD_GROUPS
} from '../../services/oxfordCoreRepository';
import {
  getGroupKey,
  getPrimaryMeaning,
  getPartOfSpeechLabel,
  isEntryComplete,
  shouldShowCefr,
  OxfordEntry
} from '../../types/oxford';

/*
 * Sözlük artık tembel yüklenir: modül içe aktarıldığında depo boştur.
 * Testler de uygulamayla aynı yolu izler, veriyi önce yükler.
 */
let entries: readonly OxfordEntry[] = [];

beforeAll(async () => {
  await loadOxfordCore();
  entries = oxfordCoreRepository.getEntries();
});

describe('Oxford çekirdek veri kümesi', () => {
  it('resmî kaynakla aynı kayıt sayısına sahiptir', () => {
    // Oxford 3000: 3308 satır, Oxford 5000 Ek: 2015 satır.
    expect(entries.length).toBe(5323);
  });

  it('altı grubun tamamı doludur', () => {
    const counts = oxfordCoreRepository.getGroupCounts();
    expect(counts.A1).toBeGreaterThan(0);
    expect(counts.A2).toBeGreaterThan(0);
    expect(counts.B1).toBeGreaterThan(0);
    expect(counts.B2).toBeGreaterThan(0);
    expect(counts.B2_EK).toBe(700);
    expect(counts.C1).toBe(1315);
  });

  it('B2 Ek ile Oxford 3000 B2 karışmaz', () => {
    // İkisi de CEFR olarak B2'dir ama kaynak grupları farklıdır.
    const b2 = oxfordCoreRepository.getEntriesByGroup('B2');
    const b2ek = oxfordCoreRepository.getEntriesByGroup('B2_EK');
    expect(b2.every(e => e.sourceCollection === 'oxford3000')).toBe(true);
    expect(b2ek.every(e => e.sourceCollection === 'oxford5000-extra')).toBe(true);
    const overlap = b2.filter(e => b2ek.some(x => x.id === e.id));
    expect(overlap).toHaveLength(0);
  });

  it('kayıt kimlikleri benzersizdir', () => {
    const ids = new Set(entries.map(e => e.id));
    expect(ids.size).toBe(entries.length);
  });

  it('sense kimlikleri benzersizdir', () => {
    const ids = new Set<string>();
    entries.forEach(e => e.senses.forEach(s => ids.add(s.id)));
    expect(ids.size).toBe(entries.reduce((n, e) => n + e.senses.length, 0));
  });

  it('kimlikler kaynak sırasına bağlı değildir', () => {
    // Sıra numarası kimliğe girmemeli; liste güncellenince kimlik kaymamalı.
    entries.slice(0, 200).forEach(entry => {
      expect(entry.id).not.toMatch(new RegExp(`-${entry.sourceOrder}$`));
    });
  });

  it('aynı kelimenin farklı sözcük türü kayıtları korunur', () => {
    // "firm n." ile "firm adj." ayrı kayıtlardır; yazılışa göre teklenmemeli.
    const firm = entries.filter(e => e.headword === 'firm');
    expect(firm.length).toBeGreaterThan(1);
    const posSets = firm.map(getPartOfSpeechLabel);
    expect(new Set(posSets).size).toBeGreaterThan(1);
  });

  it('qualifier ayrımı korunur', () => {
    const bank = entries.filter(e => e.headword === 'bank');
    const qualifiers = bank.map(e => e.qualifier).filter(Boolean);
    expect(qualifiers).toContain('money');
    expect(qualifiers).toContain('river');
  });

  it('homograf numarası korunur', () => {
    const withHomograph = entries.filter(e => e.homograph);
    expect(withHomograph.length).toBeGreaterThan(0);
    expect(withHomograph.some(e => e.headword === 'can' && e.homograph === 1)).toBe(true);
  });

  it('her kaydın en az bir sense\'i vardır', () => {
    expect(entries.every(e => e.senses.length > 0)).toBe(true);
  });

  it('çoklu sözcük türü ayrı sense olur', () => {
    const boost = entries.find(e => e.sourceEntry === 'boost v., n.');
    expect(boost).toBeDefined();
    expect(boost!.senses.map(s => s.partOfSpeech)).toEqual(['v.', 'n.']);
  });

  it('geçersiz CEFR yoktur', () => {
    const valid = new Set(['A1', 'A2', 'B1', 'B2', 'C1']);
    expect(entries.every(e => valid.has(e.cefr))).toBe(true);
  });

  it('placeholder Türkçe anlam yoktur', () => {
    const bad = /\((isim|fiil|sıfat|zarf|anlam)\)|otomatik anlam|kelimesi/i;
    const offenders = entries.filter(e =>
      e.senses.some(s => s.turkishMeanings.some(m => bad.test(m)))
    );
    expect(offenders).toHaveLength(0);
  });

  it('eksik içerik needsReview ile işaretlenir, uydurulmaz', () => {
    const incomplete = entries.filter(e => !isEntryComplete(e));
    expect(incomplete.every(e => e.needsReview === true)).toBe(true);
  });

  it('kimlikten grup çözümlenebilir', () => {
    OXFORD_GROUPS.forEach(group => {
      const bucket = oxfordCoreRepository.getEntriesByGroup(group.key);
      expect(bucket.every(e => getGroupKey(e) === group.key)).toBe(true);
    });
  });
});

describe('WordCard dönüşümü', () => {
  it('sözcük türü etiketi kaynakla aynıdır', () => {
    const boost = entries.find(e => e.sourceEntry === 'boost v., n.')!;
    expect(getPartOfSpeechLabel(boost)).toBe('v., n.');
  });

  /*
   * TEST VERİYE BAĞLI OLMAMALI.
   *
   * Bu blok eskiden `entries.find(e => e.legacyMeaning)` ile veride bir örnek
   * arıyor, bulamazsa hiçbir iddia çalıştırmadan yeşil geçiyordu. Veri
   * yeniden üretildiğinde `legacyMeaning` taşıyan kayıt kalmadı: test o günden
   * beri hiçbir şey doğrulamıyor, ama "geçti" diyordu. Kuralı veriden
   * bağımsız, elle kurulmuş kayıtlarla sınıyoruz.
   */
  const kayitKur = (
    id: string,
    turkishMeanings: string[],
    legacyMeaning?: string
  ): OxfordEntry => ({
    id,
    headword: 'about',
    cefr: 'A1',
    sourceCollection: 'oxford3000',
    sourceOrder: 1,
    sourceEntry: 'about prep., adv.',
    senses: [{ id: `${id}-prep`, partOfSpeech: 'prep.', turkishMeanings, examples: [] }],
    legacyMeaning
  });

  it('sense anlamı yoksa yedek anlam kullanılır', () => {
    expect(getPrimaryMeaning(kayitKur('t-1', [], 'hakkında'))).toBe('hakkında');
  });

  it('sense anlamı varsa yedek anlamı yener', () => {
    expect(getPrimaryMeaning(kayitKur('t-2', ['ilgili'], 'hakkında'))).toBe('ilgili');
  });

  it('gerçek veride her kaydın gösterilebilir bir anlamı var', () => {
    // Yukarıdaki iki test kuralı sınıyor; bu satır kuralın gerçek veriye
    // uygulandığında boşluk bırakmadığını sınıyor.
    const anlamsiz = entries.filter(e => !getPrimaryMeaning(e));
    expect(anlamsiz.map(e => e.id)).toEqual([]);
  });

  it('kart görünümü kimliği korur', () => {
    const entry = entries[0];
    const card = oxfordCoreRepository.getWordCardById(entry.id);
    expect(card?.id).toBe(entry.id);
    expect(card?.sourceType).toBe('oxford');
  });
});

describe('shouldShowCefr', () => {
  it('Oxford kartında seviye gösterilir', () => {
    expect(shouldShowCefr({ sourceType: 'oxford', level: 'A1' })).toBe(true);
  });

  it('kişisel kartta seviye gösterilmez', () => {
    // Kullanıcının kendi setleri serbest koleksiyonlardır; CEFR Oxford
    // kaynağının meta verisidir.
    expect(shouldShowCefr({ isCustom: true, level: 'B1' })).toBe(false);
    expect(shouldShowCefr({ sourceType: 'custom', level: 'B1' })).toBe(false);
  });

  it('seviyesi olmayan kartta gösterilmez', () => {
    expect(shouldShowCefr({ sourceType: 'oxford' })).toBe(false);
  });
});
