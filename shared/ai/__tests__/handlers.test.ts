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
