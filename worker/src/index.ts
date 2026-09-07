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
import { WORD_MODEL } from '../../shared/ai/prompts';

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

/**
 * Gemini'ye düz `fetch` ile bağlanan köprü.
 *
 * `@google/genai` paketi kullanılmadı: Node'a özgü bağımlılıklar taşıyor ve
 * Worker'ın paket boyutunu gereksiz büyütüyordu. REST karşılığı üç alanlık
 * bir gövde.
 */
function geminiKoprusu(apiKey: string): AiGateway {
  return {
    async generateJson({ prompt, systemInstruction }) {
      const yanit = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${WORD_MODEL}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            ...(systemInstruction
              ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
              : {}),
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );

      if (!yanit.ok) {
        const detay = await yanit.text();
        throw new Error(`Gemini ${yanit.status}: ${detay.slice(0, 300)}`);
      }

      const veri = (await yanit.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      return veri.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
