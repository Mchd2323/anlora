/**
 * Anlora AI — Cloudflare Worker vekili.
 *
 * NEDEN VAR. Uygulamanın çalışması için sunucu gerekmiyor: 20.000 kelimelik
 * sözlük pakete gömülü ve çevrimdışı çalışıyor. Sunucu yalnızca TEK bir iş
 * için gerekiyordu — sözlükte olmayan bir kelime için yapay zekâdan kart
 * istemek. Bunun için bir VPS ayakta tutmak, bakımını yapmak ve güncellemek
 * ölçüsüzdü.
 *
 * Bu Worker o tek işi yapar. Bakılacak bir makine yok: Cloudflare kodu
 * kendisi çalıştırır, istek gelmediğinde hiçbir şey çalışmaz.
 *
 * NEDEN ANAHTAR BURADA. Gemini anahtarı APK'ya gömülemez; APK'yı açan herkes
 * onu çıkarır ve kotayı harcar. Worker'da `wrangler secret` olarak durur,
 * istemciye hiç ulaşmaz.
 *
 * NE YAPMAZ. Hesap, bulut yedeği, yönetim paneli ve bildirim uçları burada
 * yok — onlar kalıcı depolama ister. `/api/health` bunu açıkça bildirir
 * (`capabilities`), arayüz de yalnızca gerçekten karşılanan özellikleri
 * çizer. Böylece kullanıcı basıldığında çalışmayan bir düğme görmez.
 */

import {
  handleGenerateExamples,
  handleGenerateWord,
  handleValidateSenses,
  type AiGateway,
} from '../../shared/ai/handlers';

/** Worker'a bağlanan değerler. Yalnızca ilki zorunlu. */
interface Env {
  /** `wrangler secret put GEMINI_API_KEY` ile konur. */
  GEMINI_API_KEY?: string;
  /**
   * Virgülle ayrılmış izinli kökenler. Boş bırakılırsa tüm kökenlere izin
   * verilir: APK'nın kökeni `https://localhost`, PWA'nınki kendi alan adıdır
   * ve ikisini birden bilmek gerekmez. Anahtar istemciye gitmediği için
   * buradaki gevşeklik anahtarı riske atmaz; yalnızca kotanı korumak
   * istiyorsan daralt.
   */
  ALLOWED_ORIGINS?: string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

/**
 * En iyi çaba hız sınırı.
 *
 * DÜRÜST SINIR: Worker'lar birçok kopya hâlinde çalışır ve bu sayaç her
 * kopyada ayrıdır; kararlı bir küresel sınır değildir. Gerçek koruma
 * Gemini'nin kendi kotasıdır. Buradaki sayaç tek bir betiğin aynı kopyaya
 * saniyede yüzlerce istek atmasını engeller, o kadar.
 */
const isteklerIp = new Map<string, { sayi: number; sifirlama: number }>();
const PENCERE_MS = 60_000;
const PENCERE_LIMIT = 30;

function hizSinirAsildi(ip: string): boolean {
  const simdi = Date.now();
  const kayit = isteklerIp.get(ip);

  if (!kayit || simdi > kayit.sifirlama) {
    isteklerIp.set(ip, { sayi: 1, sifirlama: simdi + PENCERE_MS });
    // Bellek sınırsız büyümesin: pencere dolan kayıtlar atılır.
    if (isteklerIp.size > 5000) {
      for (const [anahtar, deger] of isteklerIp) {
        if (simdi > deger.sifirlama) isteklerIp.delete(anahtar);
      }
    }
    return false;
  }

  kayit.sayi++;
  return kayit.sayi > PENCERE_LIMIT;
}

function corsBasliklari(request: Request, env: Env): Record<string, string> {
  const koken = request.headers.get('Origin') || '';
  const izinli = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(deger => deger.trim())
    .filter(Boolean);

  const izinVerilen = izinli.length === 0 || izinli.includes(koken) ? koken || '*' : '';

  return {
    'Access-Control-Allow-Origin': izinVerilen,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonYanit(
  govde: unknown,
  durum: number,
  cors: Record<string, string>
): Response {
  return new Response(JSON.stringify(govde), {
    status: durum,
    headers: { ...JSON_HEADERS, ...cors },
  });
}

const GEMINI_KOK = 'https://generativelanguage.googleapis.com';

/**
 * Metin üretmeyen ya da bu iş için uygun olmayan modelleri eleyen kalıplar.
 *
 * Liste `generateContent` destekleyen her şeyi veriyor; içinde görüntü, ses,
 * konuşma çözümleme ve robotik modelleri de var. Kelime kartı üretmek için
 * hiçbiri uygun değil.
 */
const ELENEN = [
  'image', 'tts', 'transcribe', 'robotics', 'computer-use', 'embedding',
  'lyria', 'nano-banana', 'deep-research', 'antigravity', 'gemma',
  'customtools', 'thinking', 'omni',
];

/** Addaki sürüm numarası: `gemini-3.8-flash` -> 3.8, bulunamazsa 0. */
function surumNo(ad: string): number {
  const eslesme = ad.match(/gemini-(\d+(?:\.\d+)?)/);
  return eslesme ? parseFloat(eslesme[1]) : 0;
}

/**
 * Denenecek modelleri sıraya dizer.
 *
 * NEDEN TEK AD DEĞİL, SIRA. Önceki sürüm tek bir ad seçiyordu ve o ad
 * listede GÖRÜNDÜĞÜ hâlde çağrılamıyordu: Gemini `gemini-2.5-flash` için
 * "artık yeni kullanıcılara açık değil" deyip 404 döndürdü. Yani listede
 * olmak çağrılabilir olmak demek değil ve bunu ancak çağırınca öğreniyoruz.
 * Sıradaki aday denenebilirse tek bir emeklilik kullanıcıyı kartsız
 * bırakmaz.
 *
 * SIRA:
 *   1. `gemini-flash-latest` — takma ad, her zaman güncel olanı gösterir ve
 *      tam da bu emeklilik sorununa karşı bağışık.
 *   2. Sürümü en yüksek kararlı flash modeli (3.8 > 3.7 > 3.6 ...).
 *   3. Öteki flash modelleri, sonra hafif (lite) ve önizleme sürümleri.
 *   4. Elde ne varsa.
 *
 * `prompts.ts`'teki tercih edilen ad artık listenin başına KONMUYOR: onu
 * sabitlemek bu hatanın kaynağıydı.
 */
export function modelAdaylari(uygun: string[]): string[] {
  const temiz = uygun.filter(ad => !ELENEN.some(kotu => ad.includes(kotu)));
  const havuz = temiz.length > 0 ? temiz : uygun;

  const puan = (ad: string): number => {
    if (ad === 'gemini-flash-latest') return 1000;
    const taban = surumNo(ad);
    const flash = ad.includes('flash');
    const lite = ad.includes('lite');
    const onizleme = ad.includes('preview');
    if (flash && !lite && !onizleme) return 500 + taban;
    if (flash && !onizleme) return 300 + taban;
    if (flash) return 200 + taban;
    if (ad.includes('latest')) return 150;
    return taban;
  };

  return [...havuz].sort((a, b) => puan(b) - puan(a));
}

/**
 * Çalıştığı KANITLANMIŞ model. Adaylardan biri gerçekten kart üretene kadar
 * doldurulmaz — listede görünmek yetmiyor.
 */
let calisanModel: { surum: string; model: string } | null = null;

/** Tanı için: hangi model çalışıyor? */
export function secilenModel(): string | null {
  return calisanModel ? `${calisanModel.surum}/${calisanModel.model}` : null;
}

/** Bu anahtarla hangi sürüm ve hangi adaylar var? Yalnızca listeyi getirir. */
async function adaylariGetir(apiKey: string): Promise<{ surum: string; adaylar: string[] }> {
  const hatalar: string[] = [];

  for (const surum of ['v1beta', 'v1']) {
    const yanit = await fetch(`${GEMINI_KOK}/${surum}/models`, {
      headers: { 'x-goog-api-key': apiKey },
    });

    if (!yanit.ok) {
      hatalar.push(`${surum}: HTTP ${yanit.status}`);
      continue;
    }

    const veri = (await yanit.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };

    const uygun = (veri.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => (m.name || '').replace(/^models\//, ''))
      .filter(Boolean);

    if (uygun.length === 0) {
      hatalar.push(`${surum}: generateContent destekleyen model yok`);
      continue;
    }

    return { surum, adaylar: modelAdaylari(uygun) };
  }

  throw new Error(`Kullanılabilir model bulunamadı (${hatalar.join('; ')})`);
}

/**
 * Tek bir modele istek atar.
 *
 * Ayrık birleşim yerine düz bir kayıt dönüyor: bu projede `strict` kapalı ve
 * `ok: true | false` üzerinden daraltma güvenilir çalışmıyor. `durum === 200`
 * bakmak aynı bilgiyi verip derleyiciye iş bırakmıyor.
 */
async function modeleSor(
  apiKey: string,
  surum: string,
  model: string,
  prompt: string,
  systemInstruction?: string
): Promise<{ durum: number; metin: string; detay: string }> {
  const yanit = await fetch(`${GEMINI_KOK}/${surum}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      ...(systemInstruction
        ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
        : {}),
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });

  if (!yanit.ok) {
    return { durum: yanit.status, metin: '', detay: (await yanit.text()).slice(0, 300) };
  }

  const veri = (await yanit.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  return { durum: 200, metin: veri.candidates?.[0]?.content?.parts?.[0]?.text || '', detay: '' };
}

/**
 * Gemini'ye düz `fetch` ile bağlanan köprü.
 *
 * `@google/genai` paketi kullanılmadı: Node'a özgü bağımlılıklar taşıyor ve
 * Worker'ın paket boyutunu gereksiz büyütüyordu.
 *
 * Çalıştığı görülen model hatırlanır; sonraki istekler doğrudan ona gider ve
 * her seferinde liste çekilmez.
 */
/**
 * Önbelleği boşaltır. Yalnızca testler için: modül düzeyindeki `calisanModel`
 * testler arasında taşınırsa sıradaki test önceki testin modelini kullanır ve
 * yedekleme davranışı hiç sınanmamış olur.
 */
export function _onbellegiBosalt(): void {
  calisanModel = null;
}

export function geminiKoprusu(apiKey: string): AiGateway {
  return {
    async generateJson({ prompt, systemInstruction }) {
      const denenenler: string[] = [];

      // Daha önce çalıştığı görülen model varsa önce o denenir: her istekte
      // model listesi çekmek gereksiz gecikme olurdu.
      if (calisanModel) {
        const sonuc = await modeleSor(
          apiKey, calisanModel.surum, calisanModel.model, prompt, systemInstruction
        );
        if (sonuc.durum === 200) return sonuc.metin;
        denenenler.push(`${calisanModel.model} -> ${sonuc.durum}`);
        // Dün çalışan model bugün emekliye ayrılmış ya da aşırı yüklü
        // olabilir. Önbelleğe takılıp kalmak yerine baştan aday aranır.
        calisanModel = null;
      }

      const { surum, adaylar } = await adaylariGetir(apiKey);
      let sonDetay = '';

      /*
       * HER HATADA SIRADAKİ ADAY DENENİR.
       *
       * Önceki sürüm hataları ikiye ayırıyordu: 404/400/403 "sıradakini
       * dene", ötekiler "hemen bırak". Gerekçesi 429'da kotayı boşa
       * harcamamaktı. Gerçek dağıtımda bu ayrım yanlış çıktı: Gemini
       * `gemini-flash-latest` için 503 "high demand" döndürdü ve kod, YÜKLÜ
       * OLMAYAN bir modeli denemeden pes etti. Yoğunluk modele özgüdür;
       * sıradakini denemek tam da doğru davranıştır.
       *
       * Dört değil beş aday: 503 geçici bir yoğunluk hatası, birkaç model
       * aynı anda yüklü olabilir.
       */
      for (const model of adaylar.slice(0, 5)) {
        const sonuc = await modeleSor(apiKey, surum, model, prompt, systemInstruction);
        if (sonuc.durum === 200) {
          calisanModel = { surum, model };
          return sonuc.metin;
        }
        denenenler.push(`${model} -> ${sonuc.durum}`);
        sonDetay = sonuc.detay;
      }

      throw new Error(
        `Hiçbir model yanıt vermedi (${denenenler.join('; ')}). Son yanıt: ${sonDetay}`
      );
    },
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsBasliklari(request, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    /*
     * Yetenek bildirimi. Arayüz bu yanıta bakarak hangi özellikleri
     * çizeceğine karar verir: burada yalnızca yapay zekâ var, hesap ve
     * bulut yedeği yok.
     */
    if (url.pathname === '/api/health') {
      return jsonYanit(
        {
          ok: true,
          service: 'anlora-ai-worker',
          capabilities: {
            ai: Boolean(env.GEMINI_API_KEY),
            accounts: false,
            sync: false,
            admin: false,
          },
          // İlk yapay zekâ isteğinden sonra dolar. Hangi modelin seçildiğini
          // görmek, 404 gibi hataları tanımanın en kısa yolu.
          model: secilenModel(),
        },
        200,
        cors
      );
    }

    /*
     * Kök adres bir uç değil, ama adrese tarayıcıdan tıklamak ilk yapılan şey.
     * Buraya düşen kişiye "Bilinmeyen uç." demek, çalışan bir kurulumu bozuk
     * gibi gösteriyordu. Ne olduğunu ve nereye bakacağını söylüyoruz.
     */
    if (url.pathname === '/' || url.pathname === '') {
      return jsonYanit(
        {
          service: 'anlora-ai-worker',
          bilgi: 'Anlora AI vekili çalışıyor. Bu adres bir uç değil.',
          durumUcu: `${url.origin}/api/health`,
        },
        200,
        cors
      );
    }

    if (!url.pathname.startsWith('/api/ai/')) {
      return jsonYanit({ error: 'Bilinmeyen uç.' }, 404, cors);
    }

    if (request.method !== 'POST') {
      return jsonYanit({ error: 'Yalnızca POST kabul edilir.' }, 405, cors);
    }

    if (!env.GEMINI_API_KEY) {
      return jsonYanit(
        {
          error: 'Yapay zekâ servisi şu anda kullanılamıyor.',
          code: 'AI_UNAVAILABLE',
          details: 'GEMINI_API_KEY tanımlı değil.',
        },
        503,
        cors
      );
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'anon';
    if (hizSinirAsildi(ip)) {
      return jsonYanit(
        {
          error: 'Çok fazla yapay zekâ isteği gönderildi. Lütfen 60 saniye sonra tekrar deneyin.',
          code: 'AI_RATE_LIMITED',
        },
        429,
        cors
      );
    }

    let govde: Record<string, unknown>;
    try {
      govde = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonYanit({ error: 'Geçersiz istek gövdesi.' }, 400, cors);
    }

    const kopru = geminiKoprusu(env.GEMINI_API_KEY);

    try {
      if (url.pathname === '/api/ai/generate-word') {
        const sonuc = await handleGenerateWord(govde, kopru);
        // Kart üretildiyse arayüz bunun doğrulanmamış olduğunu kullanıcıya
        // söyler; sunucudaki davranışla aynı.
        const govdeSon =
          sonuc.status === 200
            ? { ...sonuc.body, isAiGenerated: true, unverified: true }
            : sonuc.body;
        return jsonYanit(govdeSon, sonuc.status, cors);
      }

      if (url.pathname === '/api/ai/validate-senses') {
        const sonuc = await handleValidateSenses(govde, kopru);
        return jsonYanit(sonuc.body, sonuc.status, cors);
      }

      if (url.pathname === '/api/ai/generate-examples') {
        const sonuc = await handleGenerateExamples(govde, kopru);
        return jsonYanit(sonuc.body, sonuc.status, cors);
      }

      return jsonYanit({ error: 'Bilinmeyen uç.' }, 404, cors);
    } catch (hata) {
      const mesaj = hata instanceof Error ? hata.message : 'Bilinmeyen hata';
      return jsonYanit(
        {
          error: 'Yapay zekâ şu anda yanıt veremedi. Tekrar deneyebilirsiniz.',
          code: 'AI_ERROR',
          details: mesaj,
        },
        500,
        cors
      );
    }
  },
};
