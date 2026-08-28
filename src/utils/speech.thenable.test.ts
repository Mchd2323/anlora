import { describe, it, expect } from 'vitest';

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
