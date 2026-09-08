import { beforeEach, describe, expect, it, vi } from 'vitest';
import { _onbellegiBosalt, dusunmeDurumu, geminiKoprusu, secilenModel } from '../src/index';

/**
 * Model yedeklemesi.
 *
 * Bu davranış gerçek dağıtımda iki kez kırıldı ve ikisinde de kullanıcı
 * kartsız kaldı:
 *   1. Emekli model 404 verdi, sıradaki denenmedi.
 *   2. `gemini-flash-latest` 503 "high demand" verdi; kod 503'ü "modelle
 *      ilgili değil" sayıp YÜKLÜ OLMAYAN bir modeli denemeden pes etti.
 *
 * Ağ yerine sahte bir `fetch` konuyor: sınanan şey Gemini'nin yanıtı değil,
 * o yanıta verilen karar.
 */

const MODEL_LISTESI = {
  models: [
    { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.7-flash', supportedGenerationMethods: ['generateContent'] },
  ],
};

function kartYaniti(metin: string) {
  return { candidates: [{ content: { parts: [{ text: metin }] } }] };
}

/** Verilen model->durum eşlemesine göre yanıt veren sahte fetch. */
function sahteFetch(durumlar: Record<string, number>) {
  const cagrilar: string[] = [];
  const sahte = vi.fn(async (url: string) => {
    if (url.includes('/models?') || url.endsWith('/models')) {
      return { ok: true, status: 200, json: async () => MODEL_LISTESI } as any;
    }
    const model = (url.match(/models\/([^:]+):/) || [])[1] || '';
    cagrilar.push(model);
    const durum = durumlar[model] ?? 200;
    if (durum !== 200) {
      return {
        ok: false,
        status: durum,
        text: async () => `{"error":{"code":${durum}}}`,
      } as any;
    }
    return { ok: true, status: 200, json: async () => kartYaniti(`{"ok":"${model}"}`) } as any;
  });
  return { sahte, cagrilar };
}

describe('geminiKoprusu yedeklemesi', () => {
  beforeEach(() => {
    _onbellegiBosalt();
  });

  it('503 alınca sıradaki modeli dener', async () => {
    const { sahte, cagrilar } = sahteFetch({ 'gemini-flash-latest': 503 });
    vi.stubGlobal('fetch', sahte);

    const metin = await geminiKoprusu('anahtar').generateJson({ prompt: 'x' });

    expect(cagrilar).toEqual(['gemini-flash-latest', 'gemini-3.8-flash']);
    expect(metin).toContain('gemini-3.8-flash');
  });

  it('404 alınca da sıradaki modeli dener', async () => {
    const { sahte, cagrilar } = sahteFetch({ 'gemini-flash-latest': 404 });
    vi.stubGlobal('fetch', sahte);

    await geminiKoprusu('anahtar').generateJson({ prompt: 'x' });

    expect(cagrilar[1]).toBe('gemini-3.8-flash');
  });

  it('birden çok model yüklüyse aşağı inmeyi sürdürür', async () => {
    const { sahte, cagrilar } = sahteFetch({
      'gemini-flash-latest': 503,
      'gemini-3.8-flash': 429,
    });
    vi.stubGlobal('fetch', sahte);

    const metin = await geminiKoprusu('anahtar').generateJson({ prompt: 'x' });

    expect(cagrilar).toHaveLength(3);
    expect(metin).toContain('gemini-3.7-flash');
  });

  it('hepsi başarısızsa denenenleri hatada sayar', async () => {
    const { sahte } = sahteFetch({
      'gemini-flash-latest': 503,
      'gemini-3.8-flash': 503,
      'gemini-3.7-flash': 503,
    });
    vi.stubGlobal('fetch', sahte);

    await expect(
      geminiKoprusu('anahtar').generateJson({ prompt: 'x' })
    ).rejects.toThrow(/gemini-flash-latest -> 503.*gemini-3.7-flash -> 503/s);
  });

  it('çalışan modeli hatırlar, ikinci istekte liste çekmez', async () => {
    const { sahte, cagrilar } = sahteFetch({ 'gemini-flash-latest': 503 });
    vi.stubGlobal('fetch', sahte);
    const kopru = geminiKoprusu('anahtar');

    await kopru.generateJson({ prompt: 'bir' });
    await kopru.generateJson({ prompt: 'iki' });

    // İkinci istek doğrudan çalışan modele gitti, baştan aday aranmadı.
    expect(cagrilar).toEqual([
      'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.8-flash',
    ]);
  });

  it('hatırlanan model sonradan bozulursa yeniden aday arar', async () => {
    // Once 3.8 calisiyor, sonra o da yuklenecek.
    let ucSekizYuklu = false;
    const cagrilar: string[] = [];
    const sahte = vi.fn(async (url: string) => {
      if (url.includes('/models?') || url.endsWith('/models')) {
        return { ok: true, status: 200, json: async () => MODEL_LISTESI } as any;
      }
      const model = (url.match(/models\/([^:]+):/) || [])[1] || '';
      cagrilar.push(model);
      const bozuk =
        model === 'gemini-flash-latest' ||
        (model === 'gemini-3.8-flash' && ucSekizYuklu);
      if (bozuk) {
        return { ok: false, status: 503, text: async () => '{}' } as any;
      }
      return { ok: true, status: 200, json: async () => kartYaniti(`{"ok":"${model}"}`) } as any;
    });
    vi.stubGlobal('fetch', sahte);
    const kopru = geminiKoprusu('anahtar');

    await kopru.generateJson({ prompt: 'bir' });
    ucSekizYuklu = true;
    const metin = await kopru.generateJson({ prompt: 'iki' });

    expect(metin).toContain('gemini-3.7-flash');
  });

  it('200 ama metinsiz yanıtı başarı saymaz, sıradakini dener', async () => {
    // Gemini güvenlik engeli, boş aday listesi ya da görüntü modeli
    // yüzünden metinsiz 200 dönebiliyor. Bu yanıt başarı sayılırsa çağıran
    // boş metni ayrıştırmaya çalışır ve model yanlışlıkla önbelleğe girer.
    const cagrilar: string[] = [];
    const sahte = vi.fn(async (url: string) => {
      if (url.includes('/models?') || url.endsWith('/models')) {
        return { ok: true, status: 200, json: async () => MODEL_LISTESI } as any;
      }
      const model = (url.match(/models\/([^:]+):/) || [])[1] || '';
      cagrilar.push(model);
      if (model === 'gemini-flash-latest') {
        return { ok: true, status: 200, json: async () => ({ candidates: [] }) } as any;
      }
      return { ok: true, status: 200, json: async () => kartYaniti(`{"ok":"${model}"}`) } as any;
    });
    vi.stubGlobal('fetch', sahte);

    const metin = await geminiKoprusu('anahtar').generateJson({ prompt: 'x' });

    expect(cagrilar).toEqual(['gemini-flash-latest', 'gemini-3.8-flash']);
    expect(metin).toContain('gemini-3.8-flash');
  });

  it('metinsiz yanıt veren modeli önbelleğe almaz', async () => {
    const sahte = vi.fn(async (url: string) => {
      if (url.includes('/models?') || url.endsWith('/models')) {
        return { ok: true, status: 200, json: async () => MODEL_LISTESI } as any;
      }
      const model = (url.match(/models\/([^:]+):/) || [])[1] || '';
      if (model === 'gemini-flash-latest') {
        // Metin olmayan parca: goruntu modeli boyle doner.
        return { ok: true, status: 200, json: async () => ({
          candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png' } }] } }],
        }) } as any;
      }
      return { ok: true, status: 200, json: async () => kartYaniti('{"iyi":true}') } as any;
    });
    vi.stubGlobal('fetch', sahte);

    await geminiKoprusu('anahtar').generateJson({ prompt: 'x' });

    expect(secilenModel()).toBe('v1beta/gemini-3.8-flash');
  });

  it('400 istek hatasinda siradaki modeli denemez', async () => {
    // 400 INVALID_ARGUMENT istegin kendisiyle ilgilidir. Ayni govdeyi bes
    // modele gondermek ayni hatayi bes kez almak ve kotayi harcamaktir.
    const cagrilar: string[] = [];
    const sahte = vi.fn(async (url: string) => {
      if (url.includes('/models?') || url.endsWith('/models')) {
        return { ok: true, status: 200, json: async () => MODEL_LISTESI } as any;
      }
      const model = (url.match(/models\/([^:]+):/) || [])[1] || '';
      cagrilar.push(model);
      return {
        ok: false, status: 400,
        text: async () => '{"error":{"message":"input token count exceeds maximum"}}',
      } as any;
    });
    vi.stubGlobal('fetch', sahte);

    await expect(
      geminiKoprusu('anahtar').generateJson({ prompt: 'x' })
    ).rejects.toThrow(/400.*input token count/s);

    /*
     * ÖLÇÜT ÇAĞRI SAYISI DEĞİL, DENENEN MODEL SAYISI.
     *
     * Aynı model 400'de iki kez çağrılır: ilk istek `thinkingConfig` taşır,
     * o alanı tanımayan bir modele düşülmüş olabileceği için ikinci istek
     * alansız gider (bkz. `modeleSor`). Testin koruduğu davranış bu değil —
     * korunan şey, isteğin kendisi hatalıyken SIRADAKİ MODELE geçilmemesi.
     */
    expect(new Set(cagrilar).size).toBe(1);
    expect(cagrilar[0]).toBe('gemini-flash-latest');
  });

  it('thinkingConfig 400 verirse ayni model alansiz bir kez daha denenir', async () => {
    /*
     * Düşünme aşamasını kapatan alanı her model tanımıyor; tanımayan model
     * 400 döner. Bu kodda 400 "istek hatası" sayılıp sıradaki model hiç
     * denenmeden fırlatıldığı için, alanı körlemesine eklemek yapay zekâyı
     * tamamen durdururdu. Alansız ikinci deneme o tuzağı kapatıyor.
     */
    const govdeler: string[] = [];
    const sahte = vi.fn(async (url: string, secenek?: any) => {
      if (url.includes('/models?') || url.endsWith('/models')) {
        return { ok: true, status: 200, json: async () => MODEL_LISTESI } as any;
      }
      const govde = String(secenek?.body || '');
      govdeler.push(govde);
      if (govde.includes('thinkingConfig')) {
        return {
          ok: false, status: 400,
          text: async () => '{"error":{"message":"Unknown name \\"thinkingConfig\\""}}',
        } as any;
      }
      return { ok: true, status: 200, json: async () => kartYaniti('{"iyi":true}') } as any;
    });
    vi.stubGlobal('fetch', sahte);

    const metin = await geminiKoprusu('anahtar').generateJson({ prompt: 'x' });

    expect(metin).toBe('{"iyi":true}');
    expect(govdeler).toHaveLength(2);
    expect(govdeler[0]).toContain('thinkingConfig');
    expect(govdeler[1]).not.toContain('thinkingConfig');
    // Sağlık yanıtı bunu bildirmeli: kapatma işe yaramadıysa dışarıdan
    // görülemiyordu, çünkü her iki hâlde de kart geliyor.
    expect(dusunmeDurumu()).toBe(false);
  });

  it('normal akista tek istek gider ve dusunme kapali olur', async () => {
    // Ek çağrının bedeli yalnızca gerçekten 400 alındığında ödenmeli.
    const govdeler: string[] = [];
    const sahte = vi.fn(async (url: string, secenek?: any) => {
      if (url.includes('/models?') || url.endsWith('/models')) {
        return { ok: true, status: 200, json: async () => MODEL_LISTESI } as any;
      }
      govdeler.push(String(secenek?.body || ''));
      return { ok: true, status: 200, json: async () => kartYaniti('{"iyi":true}') } as any;
    });
    vi.stubGlobal('fetch', sahte);

    await geminiKoprusu('anahtar').generateJson({ prompt: 'x' });

    expect(govdeler).toHaveLength(1);
    expect(govdeler[0]).toContain('"thinkingBudget":0');
    expect(dusunmeDurumu()).toBe(true);
  });

  it('400 alan onbellekli model onbellekte kalir', async () => {
    let ilkTur = true;
    const sahte = vi.fn(async (url: string) => {
      if (url.includes('/models?') || url.endsWith('/models')) {
        return { ok: true, status: 200, json: async () => MODEL_LISTESI } as any;
      }
      const model = (url.match(/models\/([^:]+):/) || [])[1] || '';
      if (ilkTur) {
        return { ok: true, status: 200, json: async () => kartYaniti(`{"ok":"${model}"}`) } as any;
      }
      return { ok: false, status: 400, text: async () => '{"error":{"message":"kotu govde"}}' } as any;
    });
    vi.stubGlobal('fetch', sahte);
    const kopru = geminiKoprusu('anahtar');

    await kopru.generateJson({ prompt: 'iyi' });
    const onbellekOnce = secilenModel();
    ilkTur = false;
    await expect(kopru.generateJson({ prompt: 'kotu' })).rejects.toThrow(/400/);

    // Model suclu degil: kanitlanmis onbellek silinmemeli.
    expect(secilenModel()).toBe(onbellekOnce);
  });

  it('onbellekten dusen modeli ayni istekte tekrar denemez', async () => {
    const cagrilar: string[] = [];
    const sahte = vi.fn(async (url: string) => {
      if (url.includes('/models?') || url.endsWith('/models')) {
        return { ok: true, status: 200, json: async () => MODEL_LISTESI } as any;
      }
      const model = (url.match(/models\/([^:]+):/) || [])[1] || '';
      cagrilar.push(model);
      if (model === 'gemini-flash-latest') {
        return { ok: false, status: 503, text: async () => '{}' } as any;
      }
      return { ok: true, status: 200, json: async () => kartYaniti(`{"ok":"${model}"}`) } as any;
    });
    vi.stubGlobal('fetch', sahte);
    const kopru = geminiKoprusu('anahtar');

    await kopru.generateJson({ prompt: 'bir' });   // latest 503 -> 3.8 calisir
    cagrilar.length = 0;
    // Simdi 3.8 onbellekte; onu da bozalim ki onbellekten dussun.
    const sahte2 = vi.fn(async (url: string) => {
      if (url.includes('/models?') || url.endsWith('/models')) {
        return { ok: true, status: 200, json: async () => MODEL_LISTESI } as any;
      }
      const model = (url.match(/models\/([^:]+):/) || [])[1] || '';
      cagrilar.push(model);
      if (model === 'gemini-3.8-flash') {
        return { ok: false, status: 503, text: async () => '{}' } as any;
      }
      return { ok: true, status: 200, json: async () => kartYaniti(`{"ok":"${model}"}`) } as any;
    });
    vi.stubGlobal('fetch', sahte2);
    await kopru.generateJson({ prompt: 'iki' });

    // 3.8 bir kez denendi (onbellekten), aday dongusunde TEKRAR denenmedi.
    expect(cagrilar.filter(m => m === 'gemini-3.8-flash')).toHaveLength(1);
  });

  it('model listesi sayfalanmissa sonraki sayfayi da okur', async () => {
    /*
     * Kesif ancak DOGRUDAN deneme dustugunde calisiyor: kod once
     * `gemini-flash-latest` takma adini deniyor ve tutarsa liste hic
     * cekilmiyor (soguk baslangictaki ~20 saniye bu yuzden kalkti).
     * Bu test sayfalamayi olctugu icin takma adin dusmesi gerekiyor.
     */
    const sahte = vi.fn(async (url: string) => {
      if (url.includes('models/gemini-flash-latest:')) {
        return { ok: false, status: 404, text: async () => '{"error":"emekli"}' } as any;
      }
      if (url.includes('/models?') || url.endsWith('/models')) {
        if (url.includes('pageToken=ikinci')) {
          return { ok: true, status: 200, json: async () => ({
            models: [{ name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] }],
          }) } as any;
        }
        return { ok: true, status: 200, json: async () => ({
          models: [{ name: 'models/gemini-2.5-flash-image', supportedGenerationMethods: ['generateContent'] }],
          nextPageToken: 'ikinci',
        }) } as any;
      }
      const model = (url.match(/models\/([^:]+):/) || [])[1] || '';
      return { ok: true, status: 200, json: async () => kartYaniti(`{"ok":"${model}"}`) } as any;
    });
    vi.stubGlobal('fetch', sahte);

    const metin = await geminiKoprusu('anahtar').generateJson({ prompt: 'x' });

    // Calisan model yalnizca IKINCI sayfada vardi.
    expect(metin).toContain('gemini-3.8-flash');
  });
});

/**
 * SOĞUK BAŞLANGIÇ MALİYETİ.
 *
 * Ölçüldü: soğuk kopyada kart 28.465 ms, aynı kopyanın ikincisi 8.025 ms.
 * Aradaki ~20 saniyenin tamamı üretim değil, model listesinin çekilmesiydi.
 */
describe('soguk baslangicta model listesi cekilmiyor', () => {
  beforeEach(() => {
    _onbellegiBosalt();
  });

  it('takma ad tutarsa liste hic istenmez', async () => {
    const istekler: string[] = [];
    const sahte = vi.fn(async (url: string) => {
      istekler.push(url);
      if (url.includes('/models?') || url.endsWith('/models')) {
        return { ok: true, status: 200, json: async () => MODEL_LISTESI } as any;
      }
      return { ok: true, status: 200, json: async () => kartYaniti('{"iyi":true}') } as any;
    });
    vi.stubGlobal('fetch', sahte);

    await geminiKoprusu('anahtar').generateJson({ prompt: 'x' });

    expect(istekler.some(u => u.includes('/models?'))).toBe(false);
    expect(istekler).toHaveLength(1);
    expect(secilenModel()).toBe('v1beta/gemini-flash-latest');
  });

  it('takma ad emekliye ayrilmissa liste yine cekilir ve kart gelir', async () => {
    // Bu tam olarak gecmiste yasandi: `gemini-2.5-flash` yeni anahtarlara
    // kapatildi ve sabit ad tasiyan kod calismayi birakti. Yedek yol duruyor.
    const sahte = vi.fn(async (url: string) => {
      if (url.includes('models/gemini-flash-latest:')) {
        return { ok: false, status: 404, text: async () => '{"error":"emekli"}' } as any;
      }
      if (url.includes('/models?') || url.endsWith('/models')) {
        return { ok: true, status: 200, json: async () => MODEL_LISTESI } as any;
      }
      const model = (url.match(/models\/([^:]+):/) || [])[1] || '';
      return { ok: true, status: 200, json: async () => kartYaniti(`{"ok":"${model}"}`) } as any;
    });
    vi.stubGlobal('fetch', sahte);

    const metin = await geminiKoprusu('anahtar').generateJson({ prompt: 'x' });

    expect(metin).toContain('gemini-3.8-flash');
  });
});
