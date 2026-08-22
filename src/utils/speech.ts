export interface SpeechOptions {
  rate?: number;
  pitch?: number;
  lang?: string; // 'en-US' or 'en-GB'
}

/**
 * Ses listesi hazır olduğunda çözülen söz (promise).
 *
 * `speechSynthesis.getVoices()` Chrome ve Edge'de ilk çağrıda çoğu zaman boş
 * dizi döner; listeyi `voiceschanged` olayından sonra doldurur. Önceki
 * sürümde bu beklenmediği için sayfa açıldıktan sonraki ilk telaffuz
 * tarayıcının varsayılan sesiyle — Türkçe arayüzde çoğunlukla Türkçe bir
 * sesle — okunuyordu; İngilizce kelime Türkçe fonetikle seslendiriliyordu.
 */
let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (voicesReady) return voicesReady;

  voicesReady = new Promise<SpeechSynthesisVoice[]>(resolve => {
    if (!('speechSynthesis' in window)) {
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

export async function speakText(text: string, options: SpeechOptions = {}): Promise<void> {
  if (!('speechSynthesis' in window)) {
    console.warn('Tarayıcınız sesli okuma (SpeechSynthesis) özelliğini desteklemiyor.');
    return;
  }

  const lang = options.lang || 'en-US';
  const voices = await loadVoices();

  return new Promise<void>(resolve => {
    window.speechSynthesis.cancel(); // Stop ongoing speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = options.rate ?? 0.9;
    utterance.pitch = options.pitch ?? 1.0;

    const englishVoice = pickEnglishVoice(voices, lang);
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}

/** Tarayıcıda hiç İngilizce ses yüklü değilse arayüz bunu kullanıcıya söyleyebilir. */
export async function hasEnglishVoice(): Promise<boolean> {
  const voices = await loadVoices();
  return voices.some(v => v.lang.startsWith('en'));
}

export function stopSpeech(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
