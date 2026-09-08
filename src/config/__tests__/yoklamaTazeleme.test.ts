import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

/**
 * BAŞARISIZ YOKLAMA KALICI OLMAMALI.
 *
 * Kullanıcının bildirdiği belirti: "ilk başta ekrandaki gibiydi, şimdi Anlora
 * AI ile hazırla çıktı, neden bu kadar geç görünüyor". İki ayrı kusur vardı.
 *
 * 1. Yoklama SÜRERKEN arayüz "özellik yok" hükmü veriyordu (çağrı yerlerinde
 *    `=== true`, null'ı false'a katlıyordu).
 * 2. Yoklama bir kez BAŞARISIZ olursa sonuç oturum boyunca önbellekte
 *    kalıyordu: anlık bir ağ kesintisi Anlora AI'yı uygulama öldürülene
 *    kadar kaybettiriyordu.
 *
 * Buradaki testler ikincisini sabitliyor.
 */
describe('yetenek yoklaması', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const saglikli = () =>
    Promise.resolve({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: true, capabilities: { ai: true, accounts: false, sync: false, admin: false } })
    } as any);

  it('başarılı yoklama önbelleklenir: ikinci çağrı ağa çıkmaz', async () => {
    const sahte = vi.fn(saglikli);
    vi.stubGlobal('fetch', sahte);
    const { getApiCapabilities } = await import('../api');

    const a = await getApiCapabilities();
    const b = await getApiCapabilities();

    expect(a.ai).toBe(true);
    expect(b.ai).toBe(true);
    expect(sahte).toHaveBeenCalledTimes(1);
  });

  it('başarısız yoklama önbellekte KALMAZ; süre dolunca yeniden denenir', async () => {
    let tur = 0;
    const sahte = vi.fn(() => {
      tur++;
      // İlk deneme ağ hatası, ikincisi başarılı: telefonun tünelden çıkması.
      return tur === 1 ? Promise.reject(new Error('ag yok')) : saglikli();
    });
    vi.stubGlobal('fetch', sahte);
    const { getApiCapabilities } = await import('../api');

    const ilk = await getApiCapabilities();
    expect(ilk.ai).toBe(false);

    // Süre dolmadan yeniden denenmiyor: sunucusuz pakette her ekran
    // zaman aşımını tekrar ödemesin.
    const hemen = await getApiCapabilities();
    expect(hemen.ai).toBe(false);
    expect(sahte).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(31_000);
    const sonra = await getApiCapabilities();

    expect(sonra.ai).toBe(true);
    expect(sahte).toHaveBeenCalledTimes(2);
  });

  it('yoklamayiTazele bekleme süresini iptal eder', async () => {
    let tur = 0;
    const sahte = vi.fn(() => {
      tur++;
      return tur === 1 ? Promise.reject(new Error('ag yok')) : saglikli();
    });
    vi.stubGlobal('fetch', sahte);
    const { getApiCapabilities, yoklamayiTazele } = await import('../api');

    expect((await getApiCapabilities()).ai).toBe(false);

    // Uygulama ön plana döndü: otuz saniyeyi beklemesi için sebep yok.
    yoklamayiTazele();
    expect((await getApiCapabilities()).ai).toBe(true);
    expect(sahte).toHaveBeenCalledTimes(2);
  });
});
