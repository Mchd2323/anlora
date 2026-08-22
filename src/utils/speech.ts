export interface SpeechOptions {
  rate?: number;
  pitch?: number;
  lang?: string; // 'en-US' or 'en-GB'
}

export function speakText(text: string, options: SpeechOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Tarayıcınız sesli okuma (SpeechSynthesis) özelliğini desteklemiyor.');
      resolve();
      return;
    }

    window.speechSynthesis.cancel(); // Stop ongoing speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang || 'en-US';
    utterance.rate = options.rate ?? 0.9;
    utterance.pitch = options.pitch ?? 1.0;

    // Try to pick a natural sounding English voice
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel'))
    ) || voices.find((v) => v.lang.startsWith('en'));

    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeech(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
