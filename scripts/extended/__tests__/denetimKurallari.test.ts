import { describe, it, expect } from 'vitest';
import { sorunlar, turUyumsuzlugu, cumleIceriyor } from '../denetim_kurallari';

const ornekler = (en: string[]) => en.map(c => ({ en: c, tr: 'çeviri ' + c }));

describe('turUyumsuzlugu', () => {
  it('isim kaydına fiil yazılmışsa yakalar', () => {
    // Bant 8'de gerçekte olan: inlay (n.) için "kakmak / işlemek".
    expect(turUyumsuzlugu('n.', ['kakmak', 'işlemek'])).toMatch(/hepsi fiil/);
    expect(turUyumsuzlugu('n.', ['zorlukla yürümek', 'ağır adım yürümek'])).toMatch(/hepsi fiil/);
  });

  it('isim karşılığı isimse geçirir', () => {
    expect(turUyumsuzlugu('n.', ['kakma işi', 'dolgu'])).toBeNull();
  });

  it('mastar gibi biten gerçek isimleri elemez', () => {
    expect(turUyumsuzlugu('n.', ['yemek'])).toBeNull();
    expect(turUyumsuzlugu('n.', ['ekmek'])).toBeNull();
  });

  it('karşılıkların biri isimse isim kaydını geçirir', () => {
    expect(turUyumsuzlugu('n.', ['kaçış', 'kaçmak'])).toBeNull();
  });

  it('fiil kaydında mastar yoksa yakalar', () => {
    expect(turUyumsuzlugu('v.', ['kaçış', 'firar'])).toMatch(/mastar değil/);
  });

  it('fiil kaydında mastar varsa geçirir', () => {
    expect(turUyumsuzlugu('v.', ['kaçmak', 'sıvışmak'])).toBeNull();
  });

  it('sıfat kaydına fiil yazılmışsa yakalar', () => {
    expect(turUyumsuzlugu('adj.', ['sallanmak'])).toMatch(/hepsi fiil/);
  });

  it('tür bilinmiyorsa karışmaz', () => {
    expect(turUyumsuzlugu('prep.', ['ötürü'])).toBeNull();
  });

  it('boş listede karar vermez', () => {
    expect(turUyumsuzlugu('v.', [])).toBeNull();
  });
});

describe('sorunlar', () => {
  const saglam = {
    turkishMeanings: ['damıtma', 'öz'],
    examples: ornekler([
      'Distillation purifies the water.',
      'The book is a distillation of his work.',
      'We studied distillation in class.'
    ])
  };

  it('sağlam kaydı geçirir', () => {
    expect(sorunlar('distillation', saglam, 'n.')).toEqual([]);
  });

  it('üç örnekten azını eler', () => {
    expect(sorunlar('distillation', { ...saglam, examples: saglam.examples.slice(0, 2) }, 'n.'))
      .toContain('2 örnek');
  });

  it('kelimeyi içermeyen örneği eler', () => {
    const bozuk = { ...saglam, examples: ornekler(['It purifies the water.', 'A of his work.', 'We studied it.']) };
    expect(sorunlar('distillation', bozuk, 'n.').length).toBe(3);
  });

  it('yinelenen örneği eler', () => {
    const ayni = 'We studied distillation in class.';
    expect(sorunlar('distillation', { ...saglam, examples: ornekler([ayni, ayni, ayni]) }, 'n.'))
      .toContain('yinelenen örnek');
  });

  it('anlam kelimenin kendisiyse eler', () => {
    expect(sorunlar('widget', { ...saglam, turkishMeanings: ['widget'] }, 'n.'))
      .toContain('anlam kelimenin kendisi');
  });

  it('çevirisi olmayan örneği eler', () => {
    const bozuk = { ...saglam, examples: [{ en: 'We studied distillation.', tr: '' }] };
    expect(sorunlar('distillation', bozuk, 'n.')).toContain('örnek eksik çeviri');
  });

  it('tür verilmezse tür denetimi yapmaz', () => {
    const fiilYazilmis = { ...saglam, turkishMeanings: ['damıtmak'] };
    expect(sorunlar('distillation', fiilYazilmis)).toEqual([]);
    expect(sorunlar('distillation', fiilYazilmis, 'n.')).toContain('n. ama karşılıkların hepsi fiil');
  });
});

describe('cumleIceriyor', () => {
  it('kelime sınırına bakar, parçaya değil', () => {
    expect(cumleIceriyor('The cat sat.', 'cat')).toBe(true);
    expect(cumleIceriyor('A catalogue arrived.', 'cat')).toBe(false);
  });

  it('büyük küçük harf ayırmaz', () => {
    expect(cumleIceriyor('Cats are here.', 'cats')).toBe(true);
  });

  it('düzenli ifade karakterini kaçırır: nokta joker değil', () => {
    // Kaçırılmasaydı '.' herhangi bir harfi tutar, cümle eşleşmiş sayılırdı.
    expect(cumleIceriyor('The cXt sat.', 'c.t')).toBe(false);
    expect(cumleIceriyor('The c.t sat.', 'c.t')).toBe(true);
  });

  it('tireli kelimeyi tutar', () => {
    expect(cumleIceriyor('It is a well-known fact.', 'well-known')).toBe(true);
  });
});
