import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * SES DÜĞMESİNİN İLK BASIŞI.
 *
 * Kullanıcının bildirdiği belirti: "ses butonuna iki kere tıklamam
 * gerekiyor". İki ayrı sebebi vardı ve ikisi de burada sabitleniyor.
 *
 * 1) Açılıştaki sessiz ısıtma (`warmUpSpeech`) bir `speak` çağrısı yapıyor
 *    ve kullanıcı o sürerken düğmeye basınca iki çağrı aynı motorda üst üste
 *    biniyordu.
 * 2) Android'de metin okuma motoru ayrı bir sistem servisi; ilk çağrı onu
 *    bağlıyor ve "Not yet initialized" ile dönebiliyor. Kullanıcının elle
 *    yaptığı ikinci basış, tam olarak bir yeniden denemeydi.
 */

const kayit = vi.hoisted(() => ({
  /** Motora giden `speak` çağrıları, sırasıyla. */
  cagrilar: [] as { text: string }[],
  /** Sıradaki `speak` çağrısı için ret; null ise başarılı sayılır. */
  retler: [] as (string | null)[],
  /** `speak` sözünün kaç ms sonra yerleşeceği. */
  gecikmeMs: 0,
  /** Olay sırası: hangi adım ne zaman oldu. */
  akis: [] as string[]
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => 'android',
    isNativePlatform: () => true,
    isPluginAvailable: () => true
  }
}));

vi.mock('@capacitor-community/text-to-speech', () => ({
  TextToSpeech: {
    speak: (secenekler: { text: string }) => {
      kayit.cagrilar.push(secenekler);
      kayit.akis.push(`speak:${secenekler.text.trim() || 'bosluk'}`);
      const ret = kayit.retler.shift() ?? null;
      return new Promise<void>((cozum, hata) => {
        setTimeout(() => {
          if (ret) {
            kayit.akis.push(`ret:${secenekler.text.trim() || 'bosluk'}`);
            hata(new Error(ret));
          } else {
            kayit.akis.push(`bitti:${secenekler.text.trim() || 'bosluk'}`);
            cozum();
          }
        }, kayit.gecikmeMs);
      });
    },
    stop: () => Promise.resolve(),
    getSupportedLanguages: () => Promise.resolve({ languages: ['en-US', 'tr-TR'] })
  }
}));

/** Her test kendi modül örneğiyle çalışır: ısıtma ve dil önbelleği modül düzeyinde. */
async function tazeModul() {
  vi.resetModules();
  return await import('./speech');
}

describe('ses düğmesinin ilk basışı', () => {
  beforeEach(() => {
    kayit.cagrilar.length = 0;
    kayit.retler.length = 0;
    kayit.akis.length = 0;
    kayit.gecikmeMs = 0;
  });

  it('motor "henüz hazır değil" derse ikinci kez denenir ve okuma gerçekleşir', async () => {
    const { speakText } = await tazeModul();
    kayit.retler.push('Not yet initialized or not available on this device.');

    const sonuc = await speakText('hello');

    expect(sonuc.ok).toBe(true);
    expect(kayit.cagrilar.map(c => c.text)).toEqual(['hello', 'hello']);
  });

  it('dil paketi yoksa tekrar denenmez: bekletmek sonucu değiştirmez', async () => {
    const { speakText } = await tazeModul();
    kayit.retler.push('This language is not supported.');

    const sonuc = await speakText('hello');

    expect(sonuc).toEqual({ ok: false, reason: 'no-voice' });
    expect(kayit.cagrilar).toHaveLength(1);
  });

  it('okuma, süren ısıtmanın üstüne binmez', async () => {
    const { speakText, warmUpSpeech } = await tazeModul();
    // Isıtma anında bitmiyor; kullanıcı tam o sırada düğmeye basıyor.
    kayit.gecikmeMs = 60;

    warmUpSpeech();
    const sonuc = await speakText('hello');

    expect(sonuc.ok).toBe(true);
    // Isıtmanın sözü yerleşmeden gerçek okuma motora GİTMEMELİ.
    expect(kayit.akis.indexOf('bitti:bosluk')).toBeLessThan(
      kayit.akis.indexOf('speak:hello')
    );
  });

  it('ısıtma başarısız olsa da okuma yapılır ve kullanıcıya bildirim gitmez', async () => {
    const { speakText, warmUpSpeech, onSpeechError } = await tazeModul();
    const bildirimler: string[] = [];
    onSpeechError(sebep => bildirimler.push(sebep));

    // Isıtmanın kendisi düşüyor, ardından gerçek okuma başarılı.
    kayit.retler.push('Not yet initialized or not available on this device.');

    warmUpSpeech();
    const sonuc = await speakText('hello');

    expect(sonuc.ok).toBe(true);
    expect(bildirimler).toEqual([]);
  });
});
