import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Capacitor eklenti nesnesinin "thenable" tuzağı.
 *
 * Bu testler bir davranışı değil, BİR TUZAĞI belgeliyor. Uygulamada sesin
 * aylarca çıkmamasının sebebi buydu ve kodu okuyarak görülmesi neredeyse
 * imkânsızdı: `Promise.resolve(eklenti)` ya da `async` bir fonksiyondan
 * eklentiyi `return` etmek tamamen normal görünür.
 */
describe('Capacitor eklenti nesnesi ve sözler', () => {
  /** Capacitor'un `registerPlugin` çıktısının davranışını taklit eder. */
  function sahteEklenti() {
    return new Proxy(
      {},
      {
        get(_hedef, ad) {
          // Bilinmeyen HER ad için köprüye giden bir fonksiyon üretilir.
          // Gerçek eklentide olmayan bir metot çağrısı yanıtsız kalır.
          return () => new Promise(() => {});
        }
      }
    );
  }

  it('eklenti nesnesi "then" özelliğine sahiptir, yani thenable görünür', () => {
    const eklenti = sahteEklenti() as any;
    expect(typeof eklenti.then).toBe('function');
  });

  it('böyle bir nesneyle çözülen söz ASLA yerleşmez', async () => {
    const eklenti = sahteEklenti();

    let yerlesti = false;
    void Promise.resolve(eklenti).then(
      () => { yerlesti = true; },
      () => { yerlesti = true; }
    );

    // Mikro görevlerin ve kısa bir zamanlayıcının dönmesi için bekle.
    await new Promise(r => setTimeout(r, 50));

    expect(yerlesti).toBe(false);
  });

  it('senkron erişimde böyle bir tehlike yoktur', () => {
    const eklenti = sahteEklenti();
    const alinan = eklenti || null;
    expect(alinan).toBe(eklenti);
  });
});

/**
 * Tuzağın GERÇEK kodda kapalı olduğunu sınar.
 *
 * Yukarıdaki üç test tuzağı belgeliyor ama uygulamanın kendisine hiç
 * dokunmuyordu: `speech.ts` yarın yeniden `await eklenti` yazacak biçimde
 * değişse bu dosya yine yeşil kalırdı. Oysa dosyanın kendi başlığı "bu tuzağı
 * sabitliyor" diyor. Aşağıdaki test eklentiyi tam da o tehlikeli biçimde
 * taklit ediyor — `then` dahil BİLİNMEYEN her ad asla yerleşmeyen bir söz
 * döndürüyor — ve `speakText`in yine de sonuç verdiğini ölçüyor.
 *
 * Gerileme olursa belirti nettir: `speakText` hiç yerleşmez, `speak`
 * çağrılmaz ve test düşer; yani telaffuz düğmesinin telefonda yaptığı şeyin
 * aynısı.
 *
 * `vi.hoisted` şart: `vi.mock` fabrikaları dosyanın en üstüne taşınıyor,
 * dolayısıyla sıradan bir modül değişkenine erişemiyorlar.
 */
const kayit = vi.hoisted(() => ({ speak: [] as unknown[] }));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => 'android',
    isNativePlatform: () => true,
    isPluginAvailable: () => true
  }
}));

vi.mock('@capacitor-community/text-to-speech', () => ({
  TextToSpeech: new Proxy(
    {},
    {
      get(_hedef, ad: string | symbol) {
        if (ad === 'speak') {
          return (secenekler: unknown) => {
            kayit.speak.push(secenekler);
            return Promise.resolve();
          };
        }
        if (ad === 'stop') return () => Promise.resolve();
        if (ad === 'getSupportedLanguages') {
          return () => Promise.resolve({ languages: ['en-US', 'tr-TR'] });
        }
        // 'then' dahil geri kalan her ad: yanıtsız köprü çağrısı.
        return () => new Promise(() => {});
      }
    }
  )
}));

describe('speakText thenable tuzağına düşmez', () => {
  beforeEach(() => {
    kayit.speak.length = 0;
  });

  it('yerel eklentiyle konuşur ve söz yerleşir', async () => {
    const { speakText } = await import('./speech');

    const sonuc = await Promise.race([
      speakText('hello').then(() => 'yerlesti'),
      new Promise(r => setTimeout(() => r('asili-kaldi'), 1000))
    ]);

    expect(sonuc).toBe('yerlesti');
    expect(kayit.speak).toHaveLength(1);
    expect((kayit.speak[0] as { text: string }).text).toBe('hello');
  });
});
