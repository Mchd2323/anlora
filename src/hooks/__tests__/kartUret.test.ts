import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * TOPLU EKLEMEDE YAPAY ZEKÂ NEDEN ÇALIŞMIYORDU.
 *
 * Kullanıcının bildirdiği belirti: "çok hızlı ekledi kelimeleri ... ama
 * kelimelerin anlamlarını ve örnek cümleleri eklemedi; yeni kelime ekle
 * kısmından tekli eklediğimizde yapay zekâ çalışıyor ama toplu kelime ekleme
 * kısmından çalışmıyor."
 *
 * Sebep: kuyruk koşucusu üretimden ÖNCE `getApiCapabilities()` soruyordu.
 * Yoklamanın üç saniyelik zaman aşımı var ve başarısız sonucu otuz saniye
 * önbellekleniyor. Soğuk başlayan bir Cloudflare kopyası bunu aşınca, tek bir
 * başarısız yoklama yüzünden kuyruğun tamamı saniyeler içinde boş kartlara
 * dönüşüyordu -- üretim ucuna TEK BİR İSTEK BİLE gitmeden. Tekli ekleme yolu
 * yoklama yapmadığı için çalışmaya devam ediyordu; kullanıcının gördüğü fark
 * tam olarak buydu.
 *
 * Buradaki testler üç şeyi sabitliyor:
 *   1. Yoklamadan bağımsız olarak üretim isteği ATILIR.
 *   2. Geçici arıza kelimeyi harcamaz; yeniden denenir.
 *   3. Kalıcı arızada (sunucu yok) uydurma veri değil, BOŞ kart üretilir.
 */

const YANIT = {
  word: 'thrive',
  partOfSpeech: 'v.',
  turkishMeaning: 'gelişmek, serpilmek',
  phonetic: '/θraɪv/',
  examples: [{ english: 'Plants thrive here.', turkish: 'Bitkiler burada gelişir.' }],
  level: 'B2'
};

function jsonYanit(govde: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => govde
  } as unknown as Response;
}

describe('kuyruk kart üretimi', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Sahte zamanla bekleyen `setTimeout`'ları da ilerleten yardımcı. */
  async function bitir<T>(is: Promise<T>): Promise<T> {
    for (let i = 0; i < 30; i++) {
      await vi.advanceTimersByTimeAsync(5_000);
    }
    return is;
  }

  it('yetenek yoklaması başarısız olsa bile üretim isteği atar', async () => {
    const fetchSahte = vi.fn(async (url: string) => {
      // Yoklama ucu bilerek çöküyor: eski sürümde bu, üretimi tamamen
      // engelliyordu.
      if (url.includes('/api/health')) throw new Error('ağ yok');
      return jsonYanit(YANIT);
    });
    vi.stubGlobal('fetch', fetchSahte);

    const { kartUret } = await import('../useTopluKuyruk');
    const sonuc = await bitir(kartUret('thrive'));

    expect(sonuc.tur).toBe('kart');
    if (sonuc.tur !== 'gecici') {
      expect(sonuc.kart.turkishMeaning).toBe('gelişmek, serpilmek');
      expect(sonuc.kart.examples).toHaveLength(1);
      expect(sonuc.kart.isAiGenerated).toBe(true);
    }
    const uretimCagrilari = fetchSahte.mock.calls.filter(c =>
      String(c[0]).includes('/api/ai/generate-word')
    );
    expect(uretimCagrilari).toHaveLength(1);
  });

  it('geçici arızada kelimeyi harcamaz, yeniden dener', async () => {
    let deneme = 0;
    const fetchSahte = vi.fn(async () => {
      deneme++;
      if (deneme <= 2) return jsonYanit({ error: 'cold start' }, 503);
      return jsonYanit(YANIT);
    });
    vi.stubGlobal('fetch', fetchSahte);

    const { kartUret } = await import('../useTopluKuyruk');
    const sonuc = await bitir(kartUret('thrive'));

    expect(deneme).toBe(3);
    expect(sonuc.tur).toBe('kart');
  });

  it('denemeler tükenirse boş kart değil "geçici" döner', async () => {
    const fetchSahte = vi.fn(async () => {
      throw new Error('ağ yok');
    });
    vi.stubGlobal('fetch', fetchSahte);

    const { kartUret } = await import('../useTopluKuyruk');
    const sonuc = await bitir(kartUret('thrive'));

    // Kelime kuyrukta kalmalı: bunu boş kart saymak, kullanıcının bütün
    // listesini anlamsız kartlara çeviren hatanın ta kendisiydi.
    expect(sonuc.tur).toBe('gecici');
  });

  it('sunucu yoksa (JSON olmayan yanıt) tek denemede boş karta düşer', async () => {
    const fetchSahte = vi.fn(async () =>
      ({
        ok: true,
        status: 200,
        headers: { get: () => 'text/html' },
        json: async () => ({})
      }) as unknown as Response
    );
    vi.stubGlobal('fetch', fetchSahte);

    const { kartUret } = await import('../useTopluKuyruk');
    const sonuc = await bitir(kartUret('thrive'));

    expect(sonuc.tur).toBe('bos');
    // Yeniden denemenin anlamı yok: sunucusuz pakette yapay zekâ hiç yok.
    expect(fetchSahte).toHaveBeenCalledTimes(1);
    if (sonuc.tur !== 'gecici') {
      expect(sonuc.kart.turkishMeaning).toBe('');
      expect(sonuc.kart.isAiGenerated).toBeUndefined();
    }
  });

  it('kelime tanınmazsa uydurma kart değil boş kart döner', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonYanit({ notAWord: true, suggestion: 'thrive' })));

    const { kartUret } = await import('../useTopluKuyruk');
    const sonuc = await bitir(kartUret('thrve'));

    expect(sonuc.tur).toBe('bos');
    if (sonuc.tur !== 'gecici') expect(sonuc.kart.word).toBe('thrve');
  });

  it('Türkçe anlam gelmezse kart "eklendi" sayılmaz', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonYanit({ word: 'thrive', partOfSpeech: 'v.' })));

    const { kartUret } = await import('../useTopluKuyruk');
    const sonuc = await bitir(kartUret('thrive'));

    // Anlamı olmayan kart kullanıcı için boş karttır; listede öyle görünmeli.
    expect(sonuc.tur).toBe('bos');
  });

  /*
   * KOTA HATASI AĞ HATASI DEĞİL.
   *
   * Kullanıcı "Bağlantı bekleniyor" yazısını görüp mobil veriye geçti, sonra
   * sabit hatta bağlandı; hiçbiri değişmedi çünkü sorun ağda değildi. Türün
   * ayrı taşınması, arayüzün doğru cümleyi kurabilmesi için.
   */
  it('429 ayrı tür taşır ve yeniden denenmez', async () => {
    const fetchSahte = vi.fn(
      async () =>
        ({
          ok: false,
          status: 429,
          headers: { get: () => 'application/json' },
          text: async () => JSON.stringify({ error: { message: 'Quota exceeded' } })
        }) as unknown as Response
    );
    vi.stubGlobal('fetch', fetchSahte);

    const { kartUret } = await import('../useTopluKuyruk');
    const sonuc = await bitir(kartUret('thrive'));

    expect(sonuc.tur).toBe('gecici');
    if (sonuc.tur === 'gecici') {
      expect(sonuc.hataTuru).toBe('kota');
      expect(sonuc.hizSiniri).toBe(true);
      // Sunucunun kendi açıklaması ekrana taşınıyor: tanıyı yapan tek bilgi bu.
      expect(sonuc.neden).toContain('Quota exceeded');
    }
    // Sınıra saniyeler arayla üç kez daha vurmak sınırı açmıyor.
    expect(fetchSahte).toHaveBeenCalledTimes(1);
  });

  it('5xx sunucu türünde ve üç kez denenir', async () => {
    const fetchSahte = vi.fn(
      async () =>
        ({
          ok: false,
          status: 503,
          headers: { get: () => 'application/json' },
          text: async () => JSON.stringify({ error: 'model overloaded' })
        }) as unknown as Response
    );
    vi.stubGlobal('fetch', fetchSahte);

    const { kartUret } = await import('../useTopluKuyruk');
    const sonuc = await bitir(kartUret('thrive'));

    expect(sonuc.tur).toBe('gecici');
    if (sonuc.tur === 'gecici') {
      expect(sonuc.hataTuru).toBe('sunucu');
      expect(sonuc.neden).toContain('model overloaded');
    }
    expect(fetchSahte).toHaveBeenCalledTimes(3);
  });

  it('ağ hatası ağ türünde gelir', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ağ yok'); }));
    const { kartUret } = await import('../useTopluKuyruk');
    const sonuc = await bitir(kartUret('thrive'));
    expect(sonuc.tur).toBe('gecici');
    if (sonuc.tur === 'gecici') expect(sonuc.hataTuru).toBe('ag');
  });

  it('kelimeyi küçük harfe çevirir', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonYanit({ ...YANIT, word: 'Split Second' }))
    );
    const { kartUret } = await import('../useTopluKuyruk');
    const sonuc = await bitir(kartUret('Split Second'));
    // Tekli ekleme kutusu zaten küçük harfe çeviriyor; iki yol aynı kartı
    // üretmeli, yoksa aynı kelime iki ayrı kayıt olur.
    if (sonuc.tur !== 'gecici') expect(sonuc.kart.word).toBe('split second');
  });
});
