/**
 * API taban adresi.
 *
 * Web dağıtımında arayüz ile sunucu aynı kökenden servis edilir; göreli
 * `/api/...` yolları doğrudan çalışır ve taban boş kalır.
 *
 * Android (Capacitor) paketinde ise arayüz cihazdaki dosyalardan açılır ve
 * kökeni `https://localhost` olur. Göreli bir yol orada uygulamanın kendi
 * paketine gider, sunucuya değil. Bu yüzden APK derlenirken
 * `VITE_API_BASE_URL` ile sunucunun tam adresi verilir.
 *
 * Taban tanımlı değilse sunucuya bağlı özellikler (hesap, bulut yedeği,
 * Anlora AI) kapalıdır; Oxford çekirdeğiyle çalışma tamamen çevrimdışı
 * olduğu için uygulamanın ana işlevi bundan etkilenmez.
 */

import { Capacitor } from '@capacitor/core';

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim();

/** Sondaki eğik çizgi tekrarlı `//api` üretmesin. */
export const API_BASE = RAW_BASE.replace(/\/+$/, '');

/**
 * Kurulumun karşıladığı özellikler.
 *
 * NEDEN TEK BOOLE YETMİYOR. Uygulama üç biçimde dağıtılabiliyor:
 *   1. Sunucusuz — hiçbir uzak özellik yok.
 *   2. Tam Express sunucusu — hepsi var.
 *   3. `worker/` altındaki Cloudflare vekili — YALNIZCA yapay zekâ var;
 *      hesap ve bulut yedeği kalıcı depolama istediği için yok.
 *
 * Üçüncü kurulum tek boole ile temsil edilemez: "sunucu var" deyip giriş
 * düğmesini çizmek, basıldığında hiçbir şey yapmayan bir düğme bırakırdı.
 */
export interface ApiCapabilities {
  /** Anlora AI uçları çağrılabilir mi? */
  ai: boolean;
  /** Hesap açma, giriş, e-posta doğrulama var mı? */
  accounts: boolean;
  /** Bulut yedeği ve senkronizasyon var mı? */
  sync: boolean;
  /** Yönetim paneli uçları var mı? */
  admin: boolean;
}

const HICBIRI: ApiCapabilities = { ai: false, accounts: false, sync: false, admin: false };

/**
 * `capabilities` bildirmeyen bir sunucuya karşı davranış.
 *
 * Alanı olmayan sürüm, bu ayrımdan önce dağıtılmış tam Express sunucusudur:
 * hepsini karşılıyordu. Yokluğu "hiçbiri" saymak, çalışan bir kurulumda
 * özellikleri sessizce kapatmak olurdu.
 */
const HEPSI: ApiCapabilities = { ai: true, accounts: true, sync: true, admin: true };

/**
 * `/api/health` yanıtını yetenek kümesine çevirir.
 *
 * Saf işlev olarak ayrı duruyor ki ağ kurmadan sınanabilsin: buradaki asıl
 * karar, alanı BİLDİRMEYEN bir sunucunun hepsini karşıladığını varsaymak.
 */
export function parseCapabilities(data: unknown): ApiCapabilities {
  const bildirilen = (data as { capabilities?: unknown })?.capabilities;
  if (!bildirilen || typeof bildirilen !== 'object') return HEPSI;

  const alan = bildirilen as Record<string, unknown>;
  return {
    ai: alan.ai !== false,
    accounts: alan.accounts !== false,
    sync: alan.sync !== false,
    admin: alan.admin !== false
  };
}

let remoteProbe: Promise<ApiCapabilities> | null = null;

/**
 * Başarısız yoklamanın geçerlilik süresi (ms).
 *
 * NEDEN VAR. Önceden yoklama SONUCU değil, SÖZÜ önbelleğe alınıyordu ve
 * ayrım yoktu: bir kez başarısız olan yoklama uygulama kapanana kadar
 * "hiçbir özellik yok" olarak kalıyordu. Telefonda anlık bir ağ kesintisi,
 * tünelden geçmek ya da Cloudflare kopyasının soğuk başlaması yeterliydi --
 * Anlora AI o oturum boyunca kayboluyordu ve kullanıcı bunu ancak
 * uygulamayı öldürüp yeniden açarak düzeltebiliyordu.
 *
 * Başarı kalıcı önbelleklenir: sunucu bir kez yanıt verdiyse yeteneklerini
 * her ekran için yeniden sormanın anlamı yok.
 *
 * Başarısızlık ise GEÇİCİ sayılır. Otuz saniye, iki uç arasında duruyor:
 * her çağrıda yeniden denemek sunucusuz pakette 3 saniyelik zaman aşımını
 * tekrar tekrar ödetirdi; hiç denememek bugünkü hatadır.
 */
const BASARISIZ_TAZELIK_MS = 30_000;

/** Son başarısız yoklamanın zamanı; başarıdan sonra hiç okunmaz. */
let sonBasarisiz = 0;

/**
 * Kurulum hangi uzak özellikleri karşılıyor?
 *
 * VARSAYIM DEĞİL, ÖLÇÜM.
 *
 * Önceki sürüm "web'de arayüz sunucusuyla aynı kökendedir, öyleyse sunucu
 * vardır" diye varsayıyordu. Bu her zaman doğru değil: uygulama statik olarak
 * da yayınlanabilir (yalnızca dosya sunan bir barındırma, ya da geliştirmede
 * `vite preview`). O durumda varsayım kullanıcıyı hiç açamayacağı bir giriş
 * kapısının arkasında bırakıyordu.
 *
 * Artık sunucuya gerçekten soruluyor ve yanıtı hangi özellikleri karşıladığını
 * bildiriyor. Sonuç önbelleklenir: her ekran için yeniden yoklamak gereksiz
 * gecikme olurdu.
 */
export async function getApiCapabilities(): Promise<ApiCapabilities> {
  if (remoteProbe) return remoteProbe;

  /*
   * Son deneme başarısızsa hemen tekrar denenmiyor. Bu olmadan, başarısızlıkta
   * sözün boşaltılması her çağrıyı yeni bir ağ isteğine çevirirdi: sunucusuz
   * pakette her ekran 3 saniyelik zaman aşımını yeniden öderdi.
   */
  if (sonBasarisiz && Date.now() - sonBasarisiz < BASARISIZ_TAZELIK_MS) {
    return HICBIRI;
  }

  const baslangic = Date.now();

  remoteProbe = (async () => {
    try {
      /*
       * Kısa zaman aşımı: yanıt vermeyen bir adres yüzünden arayüz
       * beklemesin. Sunucu yoksa kullanıcı özelliğin kapalı olduğunu
       * hemen görür.
       */
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(apiUrl('/api/health'), {
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!response.ok) return HICBIRI;

      // Sunucu yoksa statik barındırma ya da Capacitor kendi index.html'ini
      // 200 ile döndürür; JSON denetimi bu ikisini ayırır.
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return HICBIRI;

      const data = await response.json();
      if (data?.ok === undefined) return HICBIRI;

      return parseCapabilities(data);
    } catch {
      return HICBIRI;
    }
  })().then(yetenekler => {
    /*
     * BAŞARISIZ YOKLAMA ÖNBELLEKTE TUTULMAZ.
     *
     * "Hiçbir özellik yok" iki farklı şeyin sonucu olabilir: sunucu
     * gerçekten yok (sunucusuz paket) ya da o an ulaşılamadı. İkisi
     * dışarıdan ayırt edilemiyor, ama ikincisinden dönüş mümkün. Sözü
     * boşaltmak bir sonraki çağrının yeniden denemesini sağlıyor;
     * `sonBasarisiz` damgası da o denemenin hemen olmasını engelliyor.
     */
    const hicbiri = !yetenekler.ai && !yetenekler.accounts && !yetenekler.sync;
    if (hicbiri) {
      sonBasarisiz = baslangic;
      remoteProbe = null;
    }
    return yetenekler;
  });

  return remoteProbe;
}

/**
 * Bekleme süresini iptal edip bir sonraki yoklamayı hemen serbest bırakır.
 *
 * Uygulama ön plana geri döndüğünde çağrılıyor: kullanıcı telefonu cebine
 * koyup çıkarana kadar ağ durumu değişmiş olabilir ve otuz saniyeyi
 * beklemesi için bir sebep yok.
 */
export function yoklamayiTazele(): void {
  sonBasarisiz = 0;
}

/*
 * BURADA BİR `hasRemoteApi()` VARDI VE KALDIRILDI.
 *
 * "Uzak özelliklerden herhangi biri var mı?" diye soruyordu. Sorunun kendisi
 * yanlıştı: çağıranların hiçbiri "herhangi biri" ile ilgilenmiyor, her biri
 * BELİRLİ bir yeteneğe bakıyor. Cloudflare vekilinde (yapay zekâ var, hesap
 * yok) doğru dönüyor ve üç ayrı yerde çalışmayan bir arayüz çiziyordu:
 * Setlerim ekranını hiç açılamayan bir üyelik kapısının arkasına koyuyor,
 * giriş formunu gösteriyor ve bildirim ayarını açıyordu.
 *
 * Yerine `getApiCapabilities()` ile ilgilenilen alana bakılıyor. İşlevi
 * geri koymak bu üç hatayı da geri getirir.
 */

/**
 * Uygulama yerel bir pakete gömülü olarak mı çalışıyor?
 *
 * Kökene bakmak yanıltıcıdır: Capacitor Android varsayılan olarak
 * `https://localhost` adresinden servis eder, yani şema tarayıcıdakiyle
 * aynıdır. Capacitor'ın kendi bildirimi tek güvenilir kaynaktır.
 */
export async function isNativeShell(): Promise<boolean> {
  // Statik içe aktarma: dinamik olanı gerçek cihazda asılı kalabiliyor
  // (bkz. utils/speech.ts başındaki açıklama).
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Göreli bir API yolunu çağrılabilir tam adrese çevirir. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${suffix}`;
}
