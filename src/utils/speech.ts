/**
 * Anlora – TELAFFUZ.
 *
 * TEK MOTOR: ANDROID'İN KENDİ METİN OKUMA SERVİSİ.
 *
 * Bu dosya bir zamanlar iki motorluydu: yerel eklenti ve tarayıcının
 * `window.speechSynthesis`i. Tarayıcı tarafı tamamen kaldırıldı, çünkü
 * Anlora bir APK olarak dağıtılıyor ve cihazdan gelen tanı `speechSynthesis
 * nesnesi yok` dedi — Android WebView konuşma sentezini uygulamıyor. Olmayan
 * bir motoru denemek, her hatayı iki ayrı ihtimale bölüyor ve teşhisi
 * zorlaştırmaktan başka işe yaramıyordu.
 *
 * ESNEK OLMAYAN TEK KURAL: EKLENTİ NESNESİ BİR SÖZÜN İÇİNDEN GEÇMEZ.
 *
 * Capacitor'ın `registerPlugin` çağrısı bir Proxy döndürür ve bu Proxy
 * BİLİNMEYEN HER ÖZELLİK için köprüye giden bir fonksiyon üretir. Yani
 * `TextToSpeech.then` de bir fonksiyondur ve nesne JavaScript'e "thenable"
 * (söz benzeri) görünür. Bir söz böyle bir nesneyle çözülmeye çalışıldığında
 * dilin söz çözüm yordamı `nesne.then(resolve, reject)` çağırır; bu köprüye
 * `then` adında OLMAYAN bir metot isteği olarak gider, karşılığı hiç gelmez
 * ve SÖZ SONSUZA KADAR ASILI KALIR.
 *
 * Uygulamada sesin çıkmamasının kök nedeni buydu ve kod okunarak görülmesi
 * neredeyse imkânsızdı: `Promise.resolve(TextToSpeech)` tamamen normal
 * görünür. Bu yüzden eklentiye erişim SENKRONDUR ve öyle kalmalıdır.
 * `speech.thenable.test.ts` bu tuzağı sabitliyor.
 */

import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export interface SpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
}

export type SpeechFailure =
  /** Yerel kabukta değiliz ya da eklenti köprüye kayıtlı değil. */
  | 'unsupported'
  /** Motor var ama cihazda İngilizce ses verisi yok. */
  | 'no-voice'
  /** Motor bir hata döndürdü. */
  | 'error';

export interface SpeechResult {
  ok: boolean;
  reason?: SpeechFailure;
}

/**
 * Eklenti nesnesi. SÖZ DÖNDÜRMEZ — dosyanın başındaki açıklamaya bakın.
 */
function getNativeTts(): typeof TextToSpeech | null {
  try {
    return TextToSpeech || null;
  } catch {
    return null;
  }
}

/** Eklenti bu kurulumda gerçekten çağrılabilir mi? */
function pluginHazir(): boolean {
  try {
    if (!Capacitor.isNativePlatform()) return false;
    if (!Capacitor.isPluginAvailable('TextToSpeech')) return false;
    return getNativeTts() !== null;
  } catch {
    return false;
  }
}

export function isNativePlatform(): Promise<boolean> {
  let sonuc = false;
  try {
    sonuc = Capacitor.isNativePlatform();
  } catch {
    sonuc = false;
  }
  return Promise.resolve(sonuc);
}

/**
 * Bir köprü hatasını okunabilir tek satıra çevirir.
 *
 * Yerel taraftan gelen hata KODU ve MESAJI teşhis için en değerli bilgi;
 * ikisini de olduğu gibi taşıyoruz. Genel bir "hata oluştu" metni,
 * kullanıcının bize iletebileceği her şeyi yok ediyordu.
 */
function hataMetni(err: any): string {
  if (!err) return 'bilinmeyen hata';
  const kod = err.code || err.errorMessage?.code;
  const mesaj = err.message || err.errorMessage || String(err);
  return kod ? `${kod}: ${mesaj}` : String(mesaj);
}

/** Cihazda kurulu İngilizce dil etiketlerinden en uygununu seçer. */
function bestEnglishTag(diller: string[], istenen: string): string | null {
  if (diller.length === 0) return null;
  if (diller.includes(istenen)) return istenen;
  const ingilizce = diller.filter(
    d => d === 'en' || d.startsWith('en-') || d.startsWith('en_')
  );
  if (ingilizce.length === 0) return null;
  return (
    ingilizce.find(d => d === 'en-US') ||
    ingilizce.find(d => d === 'en-GB') ||
    ingilizce.find(d => d === 'en') ||
    ingilizce[0]
  );
}

/** Desteklenen diller; bir kez sorulup saklanır. */
let dilOnbellek: string[] | null = null;

async function supportedLanguages(): Promise<string[]> {
  if (dilOnbellek) return dilOnbellek;
  const tts = getNativeTts();
  if (!tts) return [];
  try {
    const sonuc = await tts.getSupportedLanguages();
    dilOnbellek = sonuc?.languages || [];
  } catch {
    // Sorgu başarısız oldu; bu bir BİLGİ yokluğudur, ses yokluğu değil.
    dilOnbellek = [];
  }
  return dilOnbellek;
}

// --- Hata bildirimi --------------------------------------------------------

type SpeechErrorListener = (reason: SpeechFailure) => void;
const listeners = new Set<SpeechErrorListener>();

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

  const tts = getNativeTts();
  if (!pluginHazir() || !tts) {
    notifyFailure('unsupported');
    return { ok: false, reason: 'unsupported' };
  }

  const istenen = options.lang || 'en-US';
  const diller = await supportedLanguages();
  const secilen = bestEnglishTag(diller, istenen);

  /*
   * Yalnızca GÜVENİLİR bir olumsuz cevapta pes edilir: cihaz dilleri saydı
   * ve içlerinde tek bir İngilizce yok. Liste boş dönerse bu bir bilgi
   * yokluğudur — okumayı yine deneriz, çünkü sorgu yanlış cevap verse bile
   * motor okuyabiliyor olabilir.
   */
  if (diller.length > 0 && secilen === null) {
    notifyFailure('no-voice');
    return { ok: false, reason: 'no-voice' };
  }

  try {
    // Önceki okuma kesiliyor: art arda iki kelimede ikincisi birincinin
    // kuyruğuna takılmasın.
    await tts.stop().catch(() => undefined);

    /*
     * OKUMANIN BİTMESİ BEKLENMEZ. Eklenti sözünü ancak konuşma bittiğinde
     * çözüyor; düğmenin işi ise okumayı BAŞLATMAK. Bitişi beklemek uzun
     * cümlelerde arayüzü boş yere kilitler. Yine de sözü izliyoruz: hızlı
     * gelen bir RET, okumanın hiç başlamadığı anlamına gelir ve bunu
     * yutmuyoruz.
     */
    const cagri = tts
      .speak({
        text,
        lang: secilen || istenen,
        rate: options.rate ?? 0.85,
        pitch: options.pitch ?? 1.0,
        category: 'ambient'
      })
      .then(() => 'bitti' as const)
      .catch((err: any) => {
        son_hata = hataMetni(err);
        return 'hata' as const;
      });

    const erken = await new Promise<'bitti' | 'hata' | 'suruyor'>(resolve => {
      const t = setTimeout(() => resolve('suruyor'), 700);
      void cagri.then(s => {
        clearTimeout(t);
        resolve(s);
      });
    });

    if (erken === 'hata') {
      notifyFailure('no-voice');
      return { ok: false, reason: 'no-voice' };
    }
    return { ok: true };
  } catch (err) {
    son_hata = hataMetni(err);
    notifyFailure('error');
    return { ok: false, reason: 'error' };
  }
}

/** Son yerel hata; tanı ekranı bunu olduğu gibi gösterir. */
let son_hata = '';

/**
 * Android'in metin okuma verisi kurulum ekranını açar.
 *
 * Türkçe kurulmuş telefonlarda Google TTS çoğu zaman yalnızca Türkçe ses
 * verisiyle gelir; İngilizce indirilmeden okuma sessizce başarısız olur.
 */
export async function openTtsInstall(): Promise<boolean> {
  const tts = getNativeTts();
  if (!tts) return false;
  try {
    await tts.openInstall();
    return true;
  } catch {
    return false;
  }
}

export async function stopSpeech(): Promise<void> {
  const tts = getNativeTts();
  if (!tts) return;
  try {
    await tts.stop();
  } catch {
    /* durdurulamadıysa yapacak bir şey yok */
  }
}

/**
 * Açılışta çağrılır. Artık bekleyecek bir ses listesi yok (tarayıcı motoru
 * kaldırıldı); dil listesini erkenden ısıtmak ilk basışı hızlandırıyor.
 */
export function warmUpSpeech(): void {
  if (!pluginHazir()) return;
  void supportedLanguages().catch(() => undefined);
}

// --- Tanı ------------------------------------------------------------------

export function buildStamp(): string {
  try {
    return typeof __ANLORA_BUILD__ === 'string' ? __ANLORA_BUILD__ : 'bilinmiyor';
  } catch {
    return 'bilinmiyor';
  }
}

export interface EngineProbe {
  engine: 'web' | 'native';
  available: boolean;
  started: boolean;
  detail: string;
}

/**
 * Tanı: ÖNCE HAM GERÇEKLER, sonra yorum.
 *
 * Önceki sürüm yalnızca yorumlanmış sonuç gösteriyordu ("yanıt vermedi") ve
 * bu, altındaki gerçek durumu gizliyordu. Artık Capacitor'ın kendi
 * bildirdiği üç değer olduğu gibi yazılıyor; APK'de sırasıyla `android`,
 * `true`, `true` olmalı. Biri tutmuyorsa sorun ses kodunda değil, paketin
 * kendisindedir ve bu ayrım tek bakışta görünmelidir.
 *
 * Yerel hatalar da olduğu gibi gösteriliyor: kod ve mesaj. Zaman aşımına
 * sarıp "yanıt vermedi" demek, teşhis için en değerli bilgiyi siliyordu.
 */
export async function probeEngines(text = 'Anlora'): Promise<EngineProbe[]> {
  const results: EngineProbe[] = [];

  // --- 1. Ham ortam bilgisi ---
  let platform = '?';
  let yerel: boolean | string = '?';
  let kayitli: boolean | string = '?';
  try {
    platform = Capacitor.getPlatform();
  } catch (err) {
    platform = `hata (${hataMetni(err)})`;
  }
  try {
    yerel = Capacitor.isNativePlatform();
  } catch (err) {
    yerel = `hata (${hataMetni(err)})`;
  }
  try {
    kayitli = Capacitor.isPluginAvailable('TextToSpeech');
  } catch (err) {
    kayitli = `hata (${hataMetni(err)})`;
  }

  results.push({
    engine: 'web',
    available: yerel === true,
    started: false,
    detail:
      `getPlatform()=${platform} · ` +
      `isNativePlatform()=${yerel} · ` +
      `isPluginAvailable('TextToSpeech')=${kayitli}`
  });

  // --- 2. Eklenti gerçekten çağrılabilir mi? ---
  if (yerel !== true) {
    results.push({
      engine: 'native',
      available: false,
      started: false,
      detail:
        'Yerel kabukta değil. Anlora yalnızca APK olarak çalışır; ' +
        'tarayıcıda telaffuz yoktur.'
    });
    return results;
  }

  if (kayitli !== true) {
    results.push({
      engine: 'native',
      available: false,
      started: false,
      detail: 'TextToSpeech native eklentisi APK’ya eklenmemiş.'
    });
    return results;
  }

  const tts = getNativeTts();
  if (!tts) {
    results.push({
      engine: 'native',
      available: false,
      started: false,
      detail: 'TextToSpeech native eklentisi APK’ya eklenmemiş (nesne yok).'
    });
    return results;
  }

  // --- 3. Gerçek çağrılar; hata olduğu gibi gösterilir ---
  const satirlar: string[] = [];

  let diller: string[] = [];
  try {
    const r = await tts.getSupportedLanguages();
    diller = r?.languages || [];
    const ing = diller.filter(d => d.toLowerCase().startsWith('en'));
    satirlar.push(
      `getSupportedLanguages(): ${diller.length} dil, ${ing.length} İngilizce` +
        (ing.length ? ` (${ing.slice(0, 4).join(', ')})` : '')
    );
  } catch (err) {
    satirlar.push(`getSupportedLanguages() HATA → ${hataMetni(err)}`);
  }

  try {
    const r = await tts.getSupportedVoices();
    const sesler = r?.voices || [];
    const ing = sesler.filter((v: any) => String(v.lang || '').toLowerCase().startsWith('en'));
    satirlar.push(
      `getSupportedVoices(): ${sesler.length} ses, ${ing.length} İngilizce` +
        (ing.length ? ` (${ing.slice(0, 3).map((v: any) => v.name || v.voiceURI).join(', ')})` : '')
    );
  } catch (err) {
    satirlar.push(`getSupportedVoices() HATA → ${hataMetni(err)}`);
  }

  son_hata = '';
  let okudu = false;
  try {
    await tts.stop().catch(() => undefined);
    await tts.speak({
      text,
      lang: bestEnglishTag(diller, 'en-US') || 'en-US',
      rate: 0.85,
      pitch: 1.0,
      category: 'ambient'
    });
    okudu = true;
    satirlar.push('speak(): çağrı kabul edildi');
  } catch (err) {
    satirlar.push(`speak() HATA → ${hataMetni(err)}`);
  }

  if (son_hata) satirlar.push(`son hata: ${son_hata}`);

  results.push({
    engine: 'native',
    available: true,
    started: okudu,
    detail: satirlar.join(' · ')
  });

  return results;
}

export interface SpeechDiagnostics {
  engine: 'native' | 'web' | 'none';
  hasEnglish: boolean;
  englishVoices: string[];
  isNative: boolean;
}

export async function describeSpeechSupport(): Promise<SpeechDiagnostics> {
  const isNative = Capacitor.isNativePlatform?.() === true;

  if (!pluginHazir()) {
    return { engine: 'none', hasEnglish: false, englishVoices: [], isNative };
  }

  const diller = await supportedLanguages();
  const ingilizce = diller.filter(d => d.toLowerCase().startsWith('en'));

  return {
    /*
     * Dil listesi boş dönmek "İngilizce yok" demek DEĞİLDİR: sorgu
     * desteklenmiyor ya da yanıtsız kalmış olabilir, motor yine de
     * okuyabilir. Bu yüzden boş listede kurulum uyarısı çıkarılmıyor —
     * gereksiz yere kullanıcıyı Android ayarlarına göndermek kötü bir
     * tavsiye olurdu.
     */
    engine: 'native',
    hasEnglish: diller.length === 0 || ingilizce.length > 0,
    englishVoices: ingilizce,
    isNative
  };
}

export async function hasEnglishVoice(): Promise<boolean> {
  const rapor = await describeSpeechSupport();
  return rapor.hasEnglish;
}
