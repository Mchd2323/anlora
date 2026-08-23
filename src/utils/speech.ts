/**
 * Telaffuz seslendirme.
 *
 * İki motor vardır, çünkü tek bir API her iki ortamı da karşılamıyor:
 *
 *   * Tarayıcı → Web Speech API (`speechSynthesis`).
 *   * Android paketi → yerel Android TextToSpeech (Capacitor eklentisi).
 *
 * Android System WebView, Web Speech API'nin sentez tarafını uygulamaz:
 * `speechSynthesis` nesnesi vardır, ama `getVoices()` boş dizi döner ve
 * `speak()` sessizce hiçbir şey yapmaz — hata da fırlatmaz. Bu yüzden APK'da
 * ses düğmesi tepkisiz kalıyordu. Nesnenin varlığına bakan bir denetim bu
 * durumu yakalayamaz; ortamı sormak gerekir.
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

  try {
    // Önceki okumayı kes; kullanıcı arka arkaya kartlara basınca sesler
    // üst üste binmesin.
    await tts.stop().catch(() => undefined);
    await tts.speak({
      text,
      lang: options.lang || 'en-US',
      rate: options.rate ?? 0.9,
      pitch: options.pitch ?? 1.0,
      category: 'ambient'
    });
    return { ok: true };
  } catch (error) {
    // Cihazda İngilizce dil paketi kurulu değilse motor burada hata verir.
    const message = String((error as Error)?.message || '').toLowerCase();
    if (message.includes('lang') || message.includes('not supported')) {
      return { ok: false, reason: 'no-voice' };
    }
    return { ok: false, reason: 'error' };
  }
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
      utterance.voice = englishVoice;
    }

    let settled = false;
    const finish = (result: SpeechResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(silenceTimer);
      resolve(result);
    };

    // Sessiz başarısızlığı yakala: motor hiç başlamazsa ne `onend` ne
    // `onerror` gelir, kullanıcı da bozuk bir düğmeye bakakalır.
    const silenceTimer = window.setTimeout(() => {
      window.speechSynthesis.cancel();
      finish({ ok: false, reason: 'no-voice' });
    }, 1500);

    utterance.onstart = () => window.clearTimeout(silenceTimer);
    utterance.onend = () => finish({ ok: true });
    utterance.onerror = () => finish({ ok: false, reason: 'error' });

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

  // Yerel motor kullanılamıyorsa tarayıcı yolunu denemenin anlamı yok:
  // WebView zaten sessiz kalıyor.
  const result = (await isNativePlatform())
    ? await speakNative(text, options)
    : await speakWeb(text, options);

  if (!result.ok && result.reason) {
    notifyFailure(result.reason);
  }
  return result;
}

/** Cihazda İngilizce seslendirme yapılabiliyor mu? */
export async function hasEnglishVoice(): Promise<boolean> {
  if (await isNativePlatform()) {
    const tts = await loadNativeTts();
    if (!tts) return false;
    try {
      const { languages } = await tts.getSupportedLanguages();
      return languages.some(l => l.toLowerCase().startsWith('en'));
    } catch {
      return false;
    }
  }

  const voices = await loadVoices();
  return voices.some(v => v.lang.startsWith('en'));
}

export async function stopSpeech(): Promise<void> {
  if (await isNativePlatform()) {
    const tts = await loadNativeTts();
    await tts?.stop().catch(() => undefined);
    return;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
