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
  cors: Record<string, string>,
  ek: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(govde), {
    status: durum,
    headers: { ...JSON_HEADERS, ...cors, ...ek },
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

/**
 * Düşünme aşaması gerçekten kapatılabildi mi?
 *
 * NEDEN ÖLÇÜLÜYOR. `thinkingConfig` her modelde geçerli değil; tanımayan
 * model 400 döndürüyor ve `modeleSor` aynı isteği alansız tekrarlıyor. O
 * durumda kapatma HİÇ İŞE YARAMIYOR ve üstelik her kart için İKİ istek
 * gidiyor — yani beklenenin tersine yavaşlıyor.
 *
 * Dışarıdan bakınca ikisi ayırt edilemiyordu: her iki hâlde de kart geliyor.
 * `null` "henüz kart üretilmedi", `true` "kapatıldı", `false` "model alanı
 * reddetti, alansız gönderildi".
 */
let dusunmeKapatildi: boolean | null = null;

export function dusunmeDurumu(): boolean | null {
  return dusunmeKapatildi;
}

/** Bu anahtarla hangi sürüm ve hangi adaylar var? Yalnızca listeyi getirir. */
async function adaylariGetir(apiKey: string): Promise<{ surum: string; adaylar: string[] }> {
  const hatalar: string[] = [];

  for (const surum of ['v1beta', 'v1']) {
    /*
     * SAYFALAMA. Liste tek yanıta sığmayabiliyor; `nextPageToken` gelirse
     * sonraki sayfa da çekilir. Sayfa atlanırsa çalışan bir model listenin
     * dışında kalıp hiç denenmezdi. Üç sayfayla sınırlı: hesabın model
     * sayısı bunun çok altında ve sınırsız döngü istemiyoruz.
     */
    const uygun: string[] = [];
    let jeton = '';
    let hataliSayfa = false;

    for (let sayfa = 0; sayfa < 3; sayfa++) {
      const adres = `${GEMINI_KOK}/${surum}/models?pageSize=200${jeton ? `&pageToken=${jeton}` : ''}`;
      const yanit = await fetch(adres, { headers: { 'x-goog-api-key': apiKey } });

      if (!yanit.ok) {
        hatalar.push(`${surum}: HTTP ${yanit.status}`);
        hataliSayfa = true;
        break;
      }

      const veri = (await yanit.json()) as {
        models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
        nextPageToken?: string;
      };

      uygun.push(
        ...(veri.models || [])
          .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map(m => (m.name || '').replace(/^models\//, ''))
          .filter(Boolean)
      );

      jeton = veri.nextPageToken || '';
      if (!jeton) break;
    }

    if (hataliSayfa) continue;

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
  /*
   * DÜŞÜNME AŞAMASI KAPATILIYOR.
   *
   * Gemini'nin 2.5 ve sonrası flash modelleri, istenmese de önce bir "düşünme"
   * adımı çalıştırıyor ve ilk simge gelene kadar geçen süre buna gidiyor.
   * Bizim istediğimiz şey akıl yürütme değil, BİÇİMİ BELLİ bir sözlük kaydı:
   * anlamlar, tür, örnek cümleler. Bunun için ayrı bir düşünme adımı, kartın
   * kalitesine görülür bir şey katmadan bekleme süresine ekleniyor.
   *
   * `thinkingBudget: 0` o adımı kapatır.
   *
   * TANIMAYAN MODEL OLABİLİR. Alan her modelde geçerli değil; tanımayan model
   * 400 INVALID_ARGUMENT döner. Bu kodda 400 "istek hatası" sayılıyor ve
   * SIRADAKİ MODEL HİÇ DENENMEDEN fırlatılıyor (aşağıdaki `istekHatasi`) —
   * yani alanı körlemesine eklemek, tanımayan bir modele düşüldüğü anda yapay
   * zekâyı tamamen durdururdu. Bu yüzden 400 alınırsa aynı model alansız bir
   * kez daha denenir. Ek çağrının bedeli yalnızca gerçekten 400 alındığında
   * ödenir; normal akışta tek istek gider.
   */
  const gonder = (dusunmeyiKapat: boolean) =>
    fetch(`${GEMINI_KOK}/${surum}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(systemInstruction
          ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
          : {}),
        generationConfig: {
          responseMimeType: 'application/json',
          ...(dusunmeyiKapat ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    });

  let yanit = await gonder(true);
  if (yanit.status === 400) {
    yanit = await gonder(false);
    // Yalnızca alansız istek BAŞARILI olduysa "model bu alanı tanımıyor"
    // sonucuna varılır; ikisi de düşerse hata isteğin kendisine aittir.
    if (yanit.ok) dusunmeKapatildi = false;
  } else if (yanit.ok) {
    dusunmeKapatildi = true;
  }

  if (!yanit.ok) {
    return { durum: yanit.status, metin: '', detay: (await yanit.text()).slice(0, 300) };
  }

  const veri = (await yanit.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const metin = veri.candidates?.[0]?.content?.parts?.[0]?.text || '';

  /*
   * 200 AMA METİN YOK.
   *
   * Gemini kimi zaman başarı döndürüp içi boş bir yanıt verir: güvenlik
   * engeli, boş aday listesi ya da metin olmayan bir parça (görüntü modeli
   * `inlineData` döndürür). Bunu başarı saymak iki kat zarar veriyordu —
   * çağıran boş metni ayrıştırmaya çalışıp başarısız oluyor, ÜSTELİK o model
   * "çalışıyor" diye önbelleğe yazıldığı için aynı kopyaya gelen her istek
   * aynı şekilde boş dönüyordu. Metinsiz yanıt başarısızlıktır; sıradaki
   * aday denenmeli.
   */
  if (!metin.trim()) {
    return { durum: 204, metin: '', detay: 'yanıt metin içermiyor' };
  }

  return { durum: 200, metin, detay: '' };
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
  dusunmeKapatildi = null;
}

/**
 * Bu hata İSTEĞE mi ait, MODELE mi?
 *
 * Bir zamanlar burada 404/400/403 "modele ait" sayılıyordu, ötekiler değil.
 * O ayrım gerçek dağıtımda yanlış çıktı: 503 "high demand" modele özgüydü ve
 * kod yüklü olmayan modeli denemeden pes etti. Ayrım kaldırıldı, her hatada
 * sıradaki denendi.
 *
 * Şimdi tersinden bir tek istisna kalıyor: 400 INVALID_ARGUMENT isteğin
 * kendisiyle ilgilidir (gövde çok büyük, alan geçersiz). Aynı gövdeyi beş
 * modele göndermek aynı hatayı beş kez almak, kotayı harcamak ve gerçek
 * nedeni "Hiçbir model yanıt vermedi" mesajının altına gömmektir.
 */
function istekHatasi(durum: number): boolean {
  return durum === 400;
}

/**
 * Yukarıdan gelen durumu TAŞIYAN hata.
 *
 * NEDEN GEREKLİ. Buradaki her hata dışarıya 500 olarak çıkıyordu. Kotası
 * dolmuş bir hesap ile gerçekten arızalı bir sunucu, çağıran için aynı
 * görünüyordu: uygulama "sunucu hatası" deyip saniyeler sonra yeniden
 * deniyor, bu da dolu kotaya tekrar tekrar vurmak anlamına geliyordu.
 * Kullanıcı da ağını değiştirip duruyordu, çünkü ekranda bunun ağla ilgisi
 * olmadığını söyleyen bir şey yoktu.
 */
export class AiHatasi extends Error {
  constructor(mesaj: string, readonly durum: number) {
    super(mesaj);
    this.name = 'AiHatasi';
  }
}

export function geminiKoprusu(apiKey: string): AiGateway {
  return {
    async generateJson({ prompt, systemInstruction }) {
      const denenenler: string[] = [];
      let atlanan = '';
      let sonDetay = '';
      /** Son denemenin Gemini durumu; dışarıya aynen yansıtılıyor. */
      let sonDurum = 0;

      // Daha önce çalıştığı görülen model varsa önce o denenir: her istekte
      // model listesi çekmek gereksiz gecikme olurdu.
      const onbellek = calisanModel;
      if (onbellek) {
        const sonuc = await modeleSor(
          apiKey, onbellek.surum, onbellek.model, prompt, systemInstruction
        );
        if (sonuc.durum === 200) return sonuc.metin;

        denenenler.push(`${onbellek.model} -> ${sonuc.durum}`);
        sonDetay = sonuc.detay;
        sonDurum = sonuc.durum;

        // İstek hatasında model suçsuz: önbellek korunur, sıradaki modeli
        // denemek aynı gövdeyle aynı hatayı almak olurdu.
        if (istekHatasi(sonuc.durum)) {
          throw new AiHatasi(
            `Gemini 400 (${onbellek.surum}/${onbellek.model}): ${sonuc.detay}`,
            400
          );
        }

        /*
         * Önbellek yalnızca HÂLÂ bizim denediğimiz modeli gösteriyorsa
         * boşaltılır. Es zamanlı bir istek bu arada yeni ve çalışan bir
         * model kanıtlamış olabilir; koşulsuz `null` atamak onu silerdi.
         */
        if (calisanModel === onbellek) calisanModel = null;
        atlanan = onbellek.model;
      }

      /*
       * ÖNCE DOĞRUDAN DENE, SONRA LİSTE ÇEK.
       *
       * ÖLÇÜLDÜ. Soğuk bir Worker kopyasında kart 28.465 ms'de geldi; aynı
       * kopyanın ikinci kartı 8.025 ms. Aradaki ~20 saniyenin tamamı üretim
       * değil HAZIRLIK: model önbelleği boş olduğu için önce Gemini'nin model
       * listesi çekiliyor (iki API sürümü, sayfa sayfa, `pageSize=200`),
       * ancak ondan sonra ilk kart isteniyor.
       *
       * Oysa listenin ucunda çıkan birinci aday zaten `gemini-flash-latest`:
       * sıralama onu 1000 puanla en öne koyuyor. Yani listeyi çekmenin tek
       * yaptığı, bilinen bir adı doğrulamak için beklemekti.
       *
       * Artık takma ad DOĞRUDAN deneniyor. Tutarsa liste hiç çekilmiyor.
       * Tutmazsa -- ki bu ad bir gün yine emekliye ayrılabilir, daha önce
       * `gemini-2.5-flash` ile tam olarak bu oldu -- eski yol olduğu gibi
       * devrede: liste çekilir, adaylar sırayla denenir. Yani kazanılan şey
       * hız, kaybedilen şey yok.
       *
       * Cloudflare kopyaları sık geri dönüştürülüyor; bu yüzden "soğuk" hâl
       * kullanıcı için istisna değil, düzenli olarak karşılaştığı hâl.
       */
      if (!atlanan) {
        const dogrudan = await modeleSor(
          apiKey, 'v1beta', WORD_MODEL, prompt, systemInstruction
        );
        if (dogrudan.durum === 200) {
          calisanModel = { surum: 'v1beta', model: WORD_MODEL };
          return dogrudan.metin;
        }
        denenenler.push(`${WORD_MODEL} -> ${dogrudan.durum}`);
        sonDetay = dogrudan.detay;
        sonDurum = dogrudan.durum;
        if (istekHatasi(dogrudan.durum)) {
          throw new AiHatasi(`Gemini 400 (v1beta/${WORD_MODEL}): ${dogrudan.detay}`, 400);
        }
        atlanan = WORD_MODEL;
      }

      const { surum, adaylar } = await adaylariGetir(apiKey);

      /*
       * HER HATADA SIRADAKİ ADAY DENENİR (400 dışında, yukarıya bakın).
       * Az önce başarısız olan model listeden çıkarılır: aynı istekte onu
       * bir kez daha denemek boşa çağrıdır.
       */
      for (const model of adaylar.filter(ad => ad !== atlanan).slice(0, 5)) {
        const sonuc = await modeleSor(apiKey, surum, model, prompt, systemInstruction);
        if (sonuc.durum === 200) {
          calisanModel = { surum, model };
          return sonuc.metin;
        }
        denenenler.push(`${model} -> ${sonuc.durum}`);
        sonDetay = sonuc.detay;
        sonDurum = sonuc.durum;

        if (istekHatasi(sonuc.durum)) {
          throw new AiHatasi(`Gemini 400 (${surum}/${model}): ${sonuc.detay}`, 400);
        }
      }

      /*
       * 429 AYNEN GEÇİRİLİYOR. Bütün adaylar hız sınırına takıldıysa sorun
       * modellerde değil hesabın kotasında; bunu 500 diye bildirmek çağıranı
       * "sunucu arızası" sanıp hızla yeniden denemeye itiyor ve sınırı daha
       * da zorluyor.
       */
      throw new AiHatasi(
        `Hiçbir model yanıt vermedi (${denenenler.join('; ')}). Son yanıt: ${sonDetay}`,
        sonDurum === 429 ? 429 : 500
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
          dusunmeKapali: dusunmeDurumu(),
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
        /*
         * "Bu bir İngilizce kelime değil" cevabına kart bayrakları
         * takılmıyor: ortada üretilmiş bir kart yok, `isAiGenerated` ve
         * `unverified` orada yalan olurdu.
         */
        const kartMi = sonuc.status === 200 && !(sonuc.body as any)?.notAWord;
        const govdeSon = kartMi
          ? { ...sonuc.body, isAiGenerated: true, unverified: true }
          : sonuc.body;
        /*
         * DÜŞÜNME DURUMU YANITIN KENDİSİNDE BİLDİRİLİYOR.
         *
         * Önce `/api/health` üzerinden bildiriliyordu ve HİÇ İŞE YARAMADI:
         * ölçümde iki kart üretildikten sonra bile sağlık yanıtı
         * `"model":null, "dusunmeKapali":null` dedi. Sebep, modül düzeyindeki
         * durumun İZOLEye ait olması — Cloudflare her isteği başka bir
         * kopyaya yollayabiliyor, dolayısıyla sağlık isteği hiç kart
         * üretmemiş bir kopyaya düşüyor.
         *
         * Aynı sebeple "sıcak istek" diye bir şey de garanti değil. Buradaki
         * okuma ise üretimle AYNI isteğin içinde yapıldığı için doğru.
         */
        return jsonYanit(govdeSon, sonuc.status, cors, {
          ...sonuc.headers,
          'X-Anlora-Dusunme': String(dusunmeDurumu()),
        });
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
      const durum = hata instanceof AiHatasi ? hata.durum : 500;
      /*
       * Durum ve mesaj artık gerçeği söylüyor. Önceden her hata 500 ve tek
       * bir cümleydi; kotası dolmuş hesapla arızalı sunucu ayırt edilemiyor,
       * uygulama da ikisine aynı tepkiyi veriyordu.
       */
      const kota = durum === 429;
      return jsonYanit(
        {
          error: kota
            ? 'Anlora AI şu an istek kabul etmiyor (kota ya da hız sınırı).'
            : 'Yapay zekâ şu anda yanıt veremedi. Tekrar deneyebilirsiniz.',
          code: kota ? 'AI_RATE_LIMIT' : 'AI_ERROR',
          details: mesaj,
        },
        durum,
        cors
      );
    }
  },
};
