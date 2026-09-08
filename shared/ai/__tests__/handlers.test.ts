/**
 * Uçların çalışma ortamından bağımsız gövdesi.
 *
 * Model çağrısı sahte bir köprüyle veriliyor: buradaki sınanan şey Gemini'nin
 * yanıt kalitesi değil, ONUN ÇEVRESİNDEKİ karar zinciri — kod çitli JSON'un
 * temizlenmesi, kusurlu kartta bir kez daha denenip yine geçmezse kartın
 * DÖNDÜRÜLMEMESİ ve eksik girdinin modele hiç gitmeden reddedilmesi.
 *
 * Bu zincir hem Express sunucusunda hem Cloudflare Worker'ında aynı; iki
 * dağıtımın da güvendiği yer burası.
 */

import { describe, expect, it } from 'vitest';
import {
  handleGenerateExamples,
  handleGenerateWord,
  handleValidateSenses,
  type AiGateway,
} from '../handlers';

const kart = {
  word: 'light',
  turkishMeaning: 'ışık, hafif',
  examples: [{ en: 'She turned on the light.', tr: 'Işığı açtı.' }],
};

function sahteKapi(yanit: string, sayac?: { n: number }): AiGateway {
  return {
    async generateJson({ prompt, systemInstruction }) {
      if (sayac) sayac.n++;
      expect(prompt.length).toBeGreaterThan(20);
      void systemInstruction;
      return yanit;
    },
  };
}

describe('worker ucu akisi', () => {
  it('gecerli kart doner', async () => {
    const s = await handleGenerateWord({ word: 'light' }, sahteKapi(JSON.stringify(kart)));
    expect(s.status).toBe(200);
    expect((s.body as any).word).toBe('light');
  });

  it('kod citli yaniti ayristirir', async () => {
    const s = await handleGenerateWord(
      { word: 'light' },
      sahteKapi('```json\n' + JSON.stringify(kart) + '\n```')
    );
    expect(s.status).toBe(200);
  });

  it('kelime taninmadiginda kart uydurmak yerine yazim uyarisi doner', async () => {
    const sayac = { n: 0 };
    const s = await handleGenerateWord(
      { word: 'recieve' },
      sahteKapi(JSON.stringify({ notAWord: true, suggestion: 'receive' }), sayac)
    );
    // 200: istek basarisiz degil, cevabi "bu kelime yok". 500 donerse istemci
    // "yapay zeka yanit veremedi" der ve kullanici asil soyleneni gormez.
    expect(s.status).toBe(200);
    expect((s.body as any).notAWord).toBe(true);
    expect((s.body as any).suggestion).toBe('receive');
    // Kart dogrulamasindan gecemedigi icin BOSUNA ikinci kez denenmemeli.
    expect(sayac.n).toBe(1);
  });

  it('yazim uyarisinin onerisi kullanicinin yazdiginin ayni ise bosaltilir', async () => {
    const s = await handleGenerateWord(
      { word: 'Recieve' },
      sahteKapi(JSON.stringify({ notAWord: true, suggestion: 'recieve' }))
    );
    expect((s.body as any).suggestion).toBe('');
  });

  it('kullanici israr ederse istemde yazim denetimi istenmez', async () => {
    let gorulenIstem = '';
    const kapi: AiGateway = {
      async generateJson({ prompt }) {
        gorulenIstem = prompt;
        return JSON.stringify(kart);
      },
    };
    const denetimli = await handleGenerateWord({ word: 'light' }, kapi);
    expect(denetimli.status).toBe(200);
    expect(gorulenIstem).toContain('SPELLING CHECK FIRST');

    const zorlanmis = await handleGenerateWord({ word: 'light', yazimiZorla: true }, kapi);
    expect(zorlanmis.status).toBe(200);
    expect(gorulenIstem).not.toContain('SPELLING CHECK FIRST');
  });

  it('kusurlu kart icin iki kez dener sonra reddeder', async () => {
    const sayac = { n: 0 };
    const s = await handleGenerateWord(
      { word: 'light' },
      sahteKapi(JSON.stringify({ word: 'light', turkishMeaning: '' }), sayac)
    );
    expect(s.status).toBe(500);
    expect((s.body as any).code).toBe('AI_VALIDATION_FAILED');
    expect(sayac.n).toBe(2);
  });

  it('bos kelimeyi 400 ile reddeder', async () => {
    const s = await handleGenerateWord({ word: '  ' }, sahteKapi('{}'));
    expect(s.status).toBe(400);
  });

  it('anlam listesi bos ise 400 doner', async () => {
    const s = await handleValidateSenses({ word: 'light', userSenses: [] }, sahteKapi('{}'));
    expect(s.status).toBe(400);
  });

  it('ornek uretimi bos liste donerse hata verir', async () => {
    const s = await handleGenerateExamples(
      { word: 'light' },
      sahteKapi(JSON.stringify({ examples: [] }))
    );
    expect(s.status).toBe(500);
  });

  it('ornek uretimi calisir', async () => {
    const s = await handleGenerateExamples(
      { word: 'light', turkishMeaning: 'ışık' },
      sahteKapi(JSON.stringify({ examples: [{ en: 'a light', tr: 'bir ışık' }] }))
    );
    expect(s.status).toBe(200);
    expect((s.body as any).examples).toHaveLength(1);
  });
});

/**
 * Deneme sayısı bildiriliyor mu?
 *
 * Doğrulama düşerse kart baştan ürettiriliyor ve süre ikiye katlanıyor.
 * Dışarıdan bakınca bu görünmüyordu: kart geliyor, sadece geç geliyor.
 */
describe('handleGenerateWord deneme sayısını bildirir', () => {
  const gecerliKart = (kelime: string) => JSON.stringify({
    word: kelime,
    turkishMeaning: 'toprak kokusu',
    senses: [{
      turkishMeanings: ['toprak kokusu'],
      // Doğrulayıcı her örneğin kelimeyi geçirmesini şart koşuyor.
      examples: [{ en: 'She loves the petrichor after rain.', tr: 'Yağmurdan sonraki toprak kokusunu sever.' }]
    }],
    examples: [{ en: 'The petrichor filled the air.', tr: 'Toprak kokusu havayı doldurdu.' }]
  });

  it('ilk denemede geçen kart için 1 bildirir', async () => {
    const sonuc = await handleGenerateWord(
      { word: 'petrichor' },
      { generateJson: async () => gecerliKart('petrichor') }
    );
    expect(sonuc.status).toBe(200);
    expect(sonuc.headers?.['X-Anlora-Denemeler']).toBe('1');
  });

  it('ilk deneme düşerse 2 bildirir — sürenin ikiye katlandığı yer burası', async () => {
    let cagri = 0;
    const sonuc = await handleGenerateWord(
      { word: 'petrichor' },
      {
        generateJson: async () => {
          cagri++;
          return cagri === 1 ? 'bozuk json' : gecerliKart('petrichor');
        }
      }
    );
    expect(sonuc.status).toBe(200);
    expect(sonuc.headers?.['X-Anlora-Denemeler']).toBe('2');
  });
});
