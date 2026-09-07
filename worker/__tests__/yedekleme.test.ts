import { beforeEach, describe, expect, it, vi } from 'vitest';
import { _onbellegiBosalt, geminiKoprusu, secilenModel } from '../src/index';

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
    if (url.endsWith('/models')) {
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
      if (url.endsWith('/models')) {
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
      if (url.endsWith('/models')) {
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
      if (url.endsWith('/models')) {
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
});
