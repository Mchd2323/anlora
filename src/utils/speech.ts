/**
 * Telaffuz seslendirme.
 *
 * İki motor vardır, çünkü tek bir API her iki ortamı da karşılamıyor:
 *
 *   * Tarayıcı → Web Speech API (`speechSynthesis`).
 *   * Android paketi → yerel Android TextToSpeech (Capacitor eklentisi).
 *
 * Android System WebView'da Web Speech API'nin sentez tarafı güvenilmezdir:
 * `speechSynthesis` nesnesi her zaman vardır, ama pek çok cihazda
 * `getVoices()` boş döner ve `speak()` sessizce hiçbir şey yapmaz — hata da
 * fırlatmaz. Bu yüzden APK'da öncelik yerel motordadır; nesnenin varlığına
 * bakan bir denetim bu durumu yakalayamaz, ortamı sormak gerekir.
 *
 * Yerel motor da başarısız olursa WebView sentezi yine de denenir: bazı
 * cihazlarda çalışıyor ve denemenin maliyeti sessizlikten düşük.
 *
 * Cihazda İngilizce ses verisi yoksa hiçbir motor okuyamaz. Bu durumda
 * `openTtsInstall()` sistemin kurulum ekranını açar; `describeSpeechSupport()`
 * ise ayarlar ekranında ne bulunduğunu dürüstçe raporlar.
 */

export interface SpeechOptions {
  rate?: number;
  pitch?: number;
  lang?: string; // 'en-US' veya 'en-GB'
}

/** Seslendirmenin neden yapılamadığını arayüze bildirmek için. */
export type SpeechFailure = 'unsupported' | 'no-voice' | 'error';

export interface SpeechResult {
  ok: boolean;
  reason?: SpeechFailure;
}

// --- Ortam tespiti ---------------------------------------------------------

/**
 * Uygulama yerel bir kabukta mı çalışıyor?
 *
 * Kökene bakmak yetmez: Capacitor Android varsayılan olarak `https://localhost`
 * adresinden servis eder, yani şema tarayıcıdakiyle aynıdır. Capacitor'ın
 * kendi bildirimi tek güvenilir kaynaktır.
 */
let nativeCheck: Promise<boolean> | null = null;

export function isNativePlatform(): Promise<boolean> {
  if (nativeCheck) return nativeCheck;
  nativeCheck = (async () => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      return Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  })();
  return nativeCheck;
}

/**
 * Bir sözü zaman aşımına bağlar.
 *
 * Capacitor köprüsünden dönen sözler her zaman çözülmez. Yerel eklenti
 * `speak()` çağrısını ancak KONUŞMA BİTTİĞİNDE çözüyor; motor sessizce
 * başarısız olursa ne bitiş ne hata bildirimi geliyor ve söz sonsuza kadar
 * asılı kalıyor. Arayüzde bunun karşılığı dönmeye devam eden bir simge ve
 * hiç gelmeyen sestir. Bekleyen her köprü çağrısı bu sarmalayıcıdan geçer.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>(resolve => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback);
    }, ms);

    promise
      .then(value => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

/** Köprü çağrılarının en fazla bekleyeceği süre. */
const BRIDGE_TIMEOUT_MS = 2500;

// --- Yerel motor (Android) -------------------------------------------------

type NativeTts = typeof import('@capacitor-community/text-to-speech').TextToSpeech;

let nativeTts: Promise<NativeTts | null> | null = null;

function loadNativeTts(): Promise<NativeTts | null> {
  if (nativeTts) return nativeTts;
  nativeTts = (async () => {
    try {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
      return TextToSpeech;
    } catch {
      return null;
    }
  })();
  return nativeTts;
}

async function speakNative(text: string, options: SpeechOptions): Promise<SpeechResult> {
  const tts = await loadNativeTts();
  if (!tts) return { ok: false, reason: 'unsupported' };

  /*
   * HANGİ İNGİLİZCE ETİKETİ?
   *
   * 'en-US' sabit istemek yanlıştı: bazı cihazlarda yalnızca 'en-GB' ya da
   * düz 'en' kurulu olur ve tam eşleşme aranınca "ses yok" sonucu çıkar,
   * oysa cihaz İngilizce okuyabilmektedir. Desteklenen etiketler bir kez
   * sorulur, aralarından en uygunu seçilir.
   */
  const istenen = options.lang || 'en-US';
  const diller = await supportedLanguages(tts);
  const secilen = bestEnglishTag(diller, istenen);

  /*
   * Yalnızca GÜVENİLİR bir olumsuz cevapta pes edilir: cihaz desteklenen
   * dilleri saydı ve içlerinde tek bir İngilizce yok. Liste boş dönerse
   * (köprü susmuş ya da sorgu desteklenmiyor) bu bir bilgi yokluğudur, ses
   * yokluğu değil — okumayı yine deneriz. Önceki sürüm burada da pes ediyor
   * ve okuyabilen cihazlarda sesi kendi elimizle kesiyorduk.
   */
  if (diller.length > 0 && secilen === null) return { ok: false, reason: 'no-voice' };

  const lang = secilen || istenen;

  /*
   * OKUMANIN BİTMESİ BEKLENMEZ.
   *
   * Eklenti `speak()` sözünü ancak konuşma bittiğinde çözüyor. Düğmenin işi
   * ise okumayı BAŞLATMAK; bitişini beklemek, uzun cümlelerde arayüzü boş
   * yere kilitler, motor sessizce düşerse de sonsuza kadar bekletir.
   *
   * AYRICA BURADA `stop()` ÇAĞRILMAZ. Önceki sürüm önce `stop()` sonra
   * `speak()` ateşliyor, ikisini de beklemiyordu. Köprüde iki bekletilmemiş
   * çağrının varış sırası garanti değildir; `stop()` sonra varırsa yeni
   * başlamış okumayı anında keser — sesin hiç çıkmamasının sebebi buydu.
   * Gereksizdi de: eklentinin Android tarafı `speak()` içinde QUEUE_FLUSH
   * ile zaten `stop()` çağırıyor, yani önceki okuma kendiliğinden kesiliyor.
   */
  void tts
    .speak({
      text,
      lang,
      rate: options.rate ?? 0.9,
      pitch: options.pitch ?? 1.0,
      category: 'ambient'
    })
    .catch(() => undefined);

  return { ok: true };
}

/**
 * Cihazda kurulu İngilizce dil etiketlerinden en uygununu seçer.
 *
 * Sıra: tam eşleşme → aynı dilin başka bölgesi → düz 'en'. Hiç İngilizce
 * yoksa null döner ve çağıran taraf okumayı yine de dener: sorgu yanlış
 * cevap verse bile motor okuyabiliyorsa sesi susturmuş olmayalım.
 */
let dilOnbellek: Promise<string[]> | null = null;

async function supportedLanguages(tts: NativeTts): Promise<string[]> {
  if (!dilOnbellek) {
    dilOnbellek = withTimeout<{ languages: string[] } | null>(
      tts.getSupportedLanguages(),
      BRIDGE_TIMEOUT_MS,
      null
    ).then(r => r?.languages || []);
  }
  return dilOnbellek;
}

function bestEnglishTag(diller: string[], istenen: string): string | null {
  if (diller.length === 0) return null;
  if (diller.includes(istenen)) return istenen;
  const ingilizce = diller.filter(d => d === 'en' || d.startsWith('en-') || d.startsWith('en_'));
  if (ingilizce.length === 0) return null;
  return ingilizce.find(d => d === 'en-GB') || ingilizce.find(d => d === 'en') || ingilizce[0];
}

// --- Tarayıcı motoru -------------------------------------------------------

/**
 * Ses listesi hazır olduğunda çözülen söz (promise).
 *
 * `speechSynthesis.getVoices()` Chrome ve Edge'de ilk çağrıda çoğu zaman boş
 * dizi döner; listeyi `voiceschanged` olayından sonra doldurur. Bu
 * beklenmezse sayfa açıldıktan sonraki ilk telaffuz tarayıcının varsayılan
 * sesiyle — Türkçe arayüzde çoğunlukla Türkçe bir sesle — okunur.
 */
let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (voicesReady) return voicesReady;

  voicesReady = new Promise<SpeechSynthesisVoice[]>(resolve => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }

    const immediate = window.speechSynthesis.getVoices();
    if (immediate.length > 0) {
      resolve(immediate);
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener('voiceschanged', finish);
      resolve(window.speechSynthesis.getVoices());
    };

    window.speechSynthesis.addEventListener('voiceschanged', finish);
    // Olay hiç gelmezse (bazı mobil tarayıcılar) sonsuza kadar bekleme.
    window.setTimeout(finish, 1500);
  });

  return voicesReady;
}

function pickEnglishVoice(
  voices: SpeechSynthesisVoice[],
  lang: string
): SpeechSynthesisVoice | undefined {
  const preferredNames = ['Google', 'Natural', 'Samantha', 'Daniel'];
  return (
    voices.find(v => v.lang === lang && preferredNames.some(n => v.name.includes(n))) ||
    voices.find(v => v.lang === lang) ||
    voices.find(v => v.lang.startsWith('en') && preferredNames.some(n => v.name.includes(n))) ||
    voices.find(v => v.lang.startsWith('en'))
  );
}

/**
 * Tarayıcı motorunun "başladı" demesi için tanınan süre.
 *
 * Çalışan bir motorda `onstart` on milisaniyeler içinde gelir; bu süre yavaş
 * cihaz için pay bırakır. Uzun tutmak, sesin hiç çıkmadığı durumda yerel
 * eklentiye geçişi geciktirir ve düğme "bozuk" hissettirir.
 */
const START_WINDOW_MS = 1200;

async function speakWeb(text: string, options: SpeechOptions): Promise<SpeechResult> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return { ok: false, reason: 'unsupported' };
  }

  const lang = options.lang || 'en-US';
  const voices = await loadVoices();

  return new Promise<SpeechResult>(resolve => {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = options.rate ?? 0.9;
    utterance.pitch = options.pitch ?? 1.0;

    // Ses listesi boş olsa bile deneriz: bazı mobil tarayıcılarda
    // `getVoices()` boş döner ama motor sistem sesiyle yine de okur. Listeyi
    // boş görüp vazgeçmek, çalışan bir seslendirmeyi susturmak olurdu.
    const englishVoice = pickEnglishVoice(voices, lang);
    if (englishVoice) {
      /*
       * Ses ataması KORUMALI.
       *
       * `utterance.voice` yalnızca gerçek bir SpeechSynthesisVoice kabul
       * eder; başka bir şey atanırsa tarayıcı hata fırlatır. Bu satır
       * `speak()` çağrısından ÖNCE geldiği için fırlatılan hata okumayı
       * tamamen engeller ve söz hiç çözülmez — kullanıcının gördüğü şey yine
       * sessizlik olur. Ses seçimi bir iyileştirmedir, ön koşul değil:
       * seçemezsek `lang` ile varsayılan sesle okunur.
       */
      try {
        utterance.voice = englishVoice;
      } catch {
        /* seçilemedi; varsayılan sesle devam */
      }
    }

    let settled = false;
    const finish = (result: SpeechResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(silenceTimer);
      resolve(result);
    };

    /*
     * Sessiz başarısızlığı yakala: motor hiç başlamazsa ne `onend` ne
     * `onerror` gelir, kullanıcı da bozuk bir düğmeye bakakalır.
     *
     * Süre dolduğunda konuşma İPTAL EDİLMEZ. Önceki sürüm iptal ediyordu;
     * yavaş bir cihazda motor 1,5 saniyeden sonra başlıyorsa çalışan bir
     * seslendirmeyi kendi elimizle susturmuş oluyorduk. Artık yalnızca
     * "başlamış görünmüyor" diye bildiriliyor; ses sonradan gelirse gelsin.
     */
    const silenceTimer = window.setTimeout(() => {
      finish({ ok: false, reason: 'no-voice' });
    }, START_WINDOW_MS);

    // Başarı ölçütü BAŞLAMAKTIR, bitmek değil: düğmenin işi okumayı
    // başlatmak. Bitişi beklemek uzun cümlelerde arayüzü boş yere bekletir.
    utterance.onstart = () => finish({ ok: true });
    utterance.onend = () => finish({ ok: true });
    /*
     * Hatanın SEBEBİ önemli. Motor İngilizce ses verisi olmadığı için
     * düştüyse kullanıcıya söylenecek şey bellidir: paketi kur. "Bilinmeyen
     * hata" demek onu çaresiz bırakır. Bu yüzden İngilizce bir ses hiç
     * bulunamadıysa sebep 'no-voice' olarak bildiriliyor; ancak ses varken
     * gelen bir hata gerçekten motorun kendi hatasıdır.
     */
    utterance.onerror = () =>
      finish({ ok: false, reason: englishVoice ? 'error' : 'no-voice' });

    window.speechSynthesis.speak(utterance);
  });
}

// --- Hata bildirimi --------------------------------------------------------

type SpeechErrorListener = (reason: SpeechFailure) => void;

const listeners = new Set<SpeechErrorListener>();

/**
 * Seslendirme başarısız olduğunda haber verir.
 *
 * `speakText` on ayrı yerden çağrılıyor ve çoğu çağrı sonucu beklemiyor.
 * Her çağrı yerine hata gösterme kodu eklemek yerine — `safeStorage`'daki
 * depolama hatası aboneliğiyle aynı desende — tek bir yayın noktası
 * kullanılıyor; `ToastProvider` buna abone olup kullanıcıya bildiriyor.
 */
export function onSpeechError(listener: SpeechErrorListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyFailure(reason: SpeechFailure): void {
  listeners.forEach(listener => {
    try {
      listener(reason);
    } catch {
      /* dinleyici hatası akışı bozmamalı */
    }
  });
}

// --- Genel arayüz ----------------------------------------------------------

export async function speakText(
  text: string,
  options: SpeechOptions = {}
): Promise<SpeechResult> {
  if (!text.trim()) return { ok: false, reason: 'error' };

  /*
   * SIRALAMA: ÖNCE TARAYICI MOTORU, SONRA YEREL EKLENTİ.
   *
   * Bu sıra bir tercih değil, bir hata düzeltmesi.
   *
   * Uygulamanın ilk sürümünde ses YALNIZCA `window.speechSynthesis` ile
   * çalışıyordu ve gerçek telefonlarda sorunsuzdu. Sonra "Android WebView
   * sentezi uygulamıyor" varsayımıyla yerel eklenti eklendi ve sıra tersine
   * çevrildi: önce yerel, olmazsa tarayıcı.
   *
   * Kırılma tam buradaydı. Yerel yol, `speak()` çağrısını ateşleyip sonucu
   * BEKLEMEDEN "başarılı" diyor — çünkü eklentinin sözü ancak konuşma
   * bittiğinde çözülüyor ve onu beklemek düğmeyi kilitlerdi. Motorun
   * gerçekten ses çıkarıp çıkarmadığı bilinmiyor. Cihazda İngilizce ses
   * verisi yoksa motor sessizce düşüyor, biz "başarılı" sayıp duruyoruz ve
   * ÇALIŞAN tarayıcı motoruna hiç sıra gelmiyor. Kullanıcının gördüğü şey:
   * daha önce çalışan ses düğmesinin artık hiç ses çıkarmaması.
   *
   * Artık önce kanıtlanabilir olan deneniyor: tarayıcı motoru `onstart`
   * olayıyla okumaya BAŞLADIĞINI bildirir; bu gerçek bir kanıttır. Yalnızca
   * o başlamazsa yerel eklentiye düşülür — WebView'ın sentezi gerçekten
   * olmayan eski cihazlar için o yol duruyor.
   */
  const web = await speakWeb(text, options);
  if (web.ok) return web;

  /*
   * Tarayıcı motoru başlamadı. İki motorun üst üste konuşmaması için
   * bekleyen okuma iptal ediliyor: sessizlik zamanlayıcısı okumayı
   * kesmiyor (geç başlayan bir sesi susturmamak için), bu yüzden burada
   * açıkça temizlemek gerekiyor.
   */
  cancelWebSpeech();

  if (await isNativePlatform()) {
    const native = await speakNative(text, options);
    if (native.ok) return native;

    // İki yol da düştü. Eyleme dönük gerekçe önce gelir: "ses paketi eksik"
    // demek, "bilinmeyen hata" demekten daha işe yarar.
    notifyFailure(native.reason === 'no-voice' ? 'no-voice' : web.reason || native.reason || 'error');
    return native;
  }

  if (web.reason) notifyFailure(web.reason);
  return web;
}

/**
 * Android'in metin okuma verisi kurulum ekranını açar.
 *
 * Türkçe kurulmuş telefonlarda Google TTS çoğu zaman yalnızca Türkçe ses
 * verisiyle gelir; İngilizce veri indirilmeden `speak` sessizce başarısız
 * olur. Kullanıcıyı "Ayarlar → Diller → Metin okuma" yolunu elle bulmaya
 * zorlamak yerine sistem ekranı doğrudan açılır.
 *
 * @returns Ekran açılabildiyse true.
 */
export async function openTtsInstall(): Promise<boolean> {
  if (!(await isNativePlatform())) return false;
  const tts = await loadNativeTts();
  if (!tts) return false;
  const ok = await withTimeout<boolean>(
    tts.openInstall().then(() => true),
    BRIDGE_TIMEOUT_MS,
    false
  );
  return ok;
}

/**
 * İki motorun AYRI AYRI denenmesi.
 *
 * Ses çalışmadığında tek bir "olmadı" mesajı yetmiyor: sorunun tarayıcı
 * motorunda mı, yerel eklentide mi, yoksa ikisinde birden mi olduğunu
 * ayırt etmek gerekiyor. Bu işlev her iki yolu sırayla dener ve ne olduğunu
 * satır satır anlatır; kullanıcı ekrandaki metni okuyup aktarabilir.
 *
 * Denemeler arasında tarayıcı motoru susturulur, yoksa iki ses üst üste
 * biner.
 */
export interface EngineProbe {
  engine: 'web' | 'native';
  available: boolean;
  started: boolean;
  detail: string;
}

export async function probeEngines(text = 'Anlora'): Promise<EngineProbe[]> {
  const results: EngineProbe[] = [];

  // --- Tarayıcı motoru ---
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    results.push({ engine: 'web', available: false, started: false, detail: 'speechSynthesis nesnesi yok' });
  } else {
    const voices = await loadVoices();
    const english = voices.filter(v => v.lang.startsWith('en'));
    const sonuc = await speakWeb(text, {});
    cancelWebSpeech();
    results.push({
      engine: 'web',
      available: true,
      started: sonuc.ok,
      detail: `${voices.length} ses, ${english.length} İngilizce` +
        (sonuc.ok ? ' — okumaya başladı' : ` — başlamadı (${sonuc.reason})`)
    });
  }

  // --- Yerel eklenti ---
  if (!(await isNativePlatform())) {
    results.push({ engine: 'native', available: false, started: false, detail: 'yerel kabukta değil (tarayıcı)' });
    return results;
  }

  const tts = await loadNativeTts();
  if (!tts) {
    results.push({ engine: 'native', available: false, started: false, detail: 'eklenti yüklenemedi' });
    return results;
  }

  const diller = await supportedLanguages(tts);
  const ing = diller.filter(d => d === 'en' || d.startsWith('en-') || d.startsWith('en_'));
  const sonuc = await speakNative(text, {});
  results.push({
    engine: 'native',
    available: true,
    started: sonuc.ok,
    detail:
      (diller.length ? `${diller.length} dil, ${ing.length} İngilizce (${ing.slice(0, 3).join(', ') || 'yok'})` : 'dil listesi boş') +
      (sonuc.ok ? ' — çağrı gönderildi' : ` — gönderilemedi (${sonuc.reason})`)
  });

  return results;
}

export interface SpeechDiagnostics {
  /** Hangi motorun kullanılacağı. */
  engine: 'native' | 'web' | 'none';
  /** Cihazda İngilizce seslendirme yapılabiliyor mu? */
  hasEnglish: boolean;
  /** Bulunan İngilizce ses/dil adları; ayarlar ekranında gösterilir. */
  englishVoices: string[];
  /** Yerel platformda mıyız? Kurulum kısayolu yalnızca burada anlamlı. */
  isNative: boolean;
}

/**
 * Seslendirme desteğini raporlar.
 *
 * Kullanıcı "ses çıkmıyor" dediğinde nedenin cihazda mı yoksa uygulamada mı
 * olduğunu ayırt etmenin tek yolu ölçmek. Ayarlar ekranı bu raporu gösterir.
 */
export async function describeSpeechSupport(): Promise<SpeechDiagnostics> {
  if (await isNativePlatform()) {
    const tts = await loadNativeTts();
    if (!tts) {
      return { engine: 'none', hasEnglish: false, englishVoices: [], isNative: true };
    }
    const result = await withTimeout<{ languages: string[] } | null>(
      tts.getSupportedLanguages(),
      BRIDGE_TIMEOUT_MS,
      null
    );

    if (result === null) {
      /*
       * Köprü yanıt vermedi. Bu bir "cihazda ses yok" durumu değil, eklentinin
       * yanıtsız kalmasıdır; tarayıcı motoru hâlâ çalışıyor olabilir, o yüzden
       * rapor ona göre verilir.
       */
      const voices = await loadVoices();
      const english = voices.filter(voice => voice.lang.startsWith('en'));
      return {
        engine: english.length > 0 ? 'web' : 'none',
        hasEnglish: english.length > 0,
        englishVoices: english.map(voice => `${voice.name} (${voice.lang})`),
        isNative: true,
      };
    }

    const english = result.languages.filter(lang => lang.toLowerCase().startsWith('en'));

    /*
     * YEREL MOTORDA İNGİLİZCE YOKSA HEMEN "ses yok" DENMEZ.
     *
     * Okuma sırası artık önce tarayıcı motoru; o çalışıyorsa yerel eklentiye
     * hiç sıra gelmiyor. Dolayısıyla yerel motorda İngilizce bulunmaması tek
     * başına bir eksiklik değil — tarayıcı tarafı okuyorsa kullanıcı için
     * her şey yolunda demektir. Buna bakmadan "ses paketini kur" uyarısı
     * göstermek, sesi çalışan kullanıcıyı gereksiz yere uğraştırırdı.
     */
    if (english.length === 0) {
      const voices = await loadVoices();
      const webEnglish = voices.filter(voice => voice.lang.startsWith('en'));
      if (webEnglish.length > 0) {
        return {
          engine: 'web',
          hasEnglish: true,
          englishVoices: webEnglish.map(voice => `${voice.name} (${voice.lang})`),
          isNative: true,
        };
      }
    }

    return {
      engine: 'native',
      hasEnglish: english.length > 0,
      englishVoices: english,
      isNative: true,
    };
  }

  const voices = await loadVoices();
  const english = voices.filter(voice => voice.lang.startsWith('en'));
  return {
    engine: voices.length > 0 || typeof window !== 'undefined' && 'speechSynthesis' in window
      ? 'web'
      : 'none',
    hasEnglish: english.length > 0,
    englishVoices: english.map(voice => `${voice.name} (${voice.lang})`),
    isNative: false,
  };
}

/** Cihazda İngilizce seslendirme yapılabiliyor mu? */
export async function hasEnglishVoice(): Promise<boolean> {
  if (await isNativePlatform()) {
    const tts = await loadNativeTts();
    if (!tts) return false;
    const result = await withTimeout<{ languages: string[] } | null>(
      tts.getSupportedLanguages(),
      BRIDGE_TIMEOUT_MS,
      null
    );
    if (result) return result.languages.some(l => l.toLowerCase().startsWith('en'));
    // Köprü sustuysa tarayıcı motoruna bak.
    const voices = await loadVoices();
    return voices.some(v => v.lang.startsWith('en'));
  }

  const voices = await loadVoices();
  return voices.some(v => v.lang.startsWith('en'));
}

/**
 * Ses listesini önceden ısıtır.
 *
 * NEDEN GEREKLİ. `speakWeb` konuşmadan önce `loadVoices()`'ı bekliyor. İlk
 * çağrıda bu bekleme 1,5 saniyeye kadar çıkabilir ve tarayıcı o sırada
 * KULLANICI DOKUNUŞU BAĞLAMINI kaybeder. Mobil tarayıcılar sesi yalnızca
 * bir dokunuşun doğrudan devamında başlatmaya izin verir; bağlam kaybolunca
 * `speak()` sessizce hiçbir şey yapmaz. Yani motor sağlamken bile ilk basış
 * sessiz kalabilir.
 *
 * Uygulama açılırken bir kez çağrılınca liste hazır olur ve düğmeye
 * basıldığında bekleme kalmaz.
 */
export function warmUpSpeech(): void {
  void loadVoices().catch(() => undefined);
}

/**
 * Yalnızca TARAYICI motorunu susturur.
 *
 * `stopSpeech` yerel kabukta yalnızca eklentiyi durduruyor; oysa iki motorun
 * üst üste konuşmasını önlemek için tam olarak tarayıcı tarafını kesmek
 * gerekiyor. Ayrı bir işlev olmasının sebebi bu.
 */
function cancelWebSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export async function stopSpeech(): Promise<void> {
  if (await isNativePlatform()) {
    const tts = await loadNativeTts();
    if (tts) await withTimeout(tts.stop(), BRIDGE_TIMEOUT_MS, undefined);
    return;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
