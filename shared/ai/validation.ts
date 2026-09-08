/**
 * Yapay zekânın ürettiği kelime kartının denetimi.
 *
 * NEDEN AYRI DOSYA. Bu mantık iki ayrı çalışma ortamından çağrılıyor:
 * `server.ts` (Express, Node) ve `worker/src/index.ts` (Cloudflare Worker).
 * İkisine ayrı ayrı kopyalansaydı biri düzeltilip öteki unutulurdu — ki
 * burada unutmanın bedeli, veriye şablon cümle sızması demek.
 *
 * Saf işlevdir: ağ, dosya sistemi ya da çalışma ortamı bilgisi kullanmaz.
 */

import { cumledeGeciyorMu } from './inflections';

export function validateGeneratedWordCard(card: any, targetWord: string): boolean {
  if (!card || typeof card !== 'object') return false;
  const word = (card.word || targetWord || '').trim().toLowerCase();
  
  // 1. Check primary Turkish meaning
  const primaryTr = (card.turkishMeaning || '').trim().toLowerCase();
  if (!primaryTr) return false;

  const badTrKeywords = ['kelimesi', 'otomatik anlam', '(anlam)', `${word} (`];
  for (const kw of badTrKeywords) {
    if (primaryTr.includes(kw)) return false;
  }

  const commonLoanwords = new Set([
    'internet', 'festival', 'model', 'robot', 'radyo', 'otel', 'film', 'doktor',
    'park', 'taksi', 'tren', 'otobüs', 'kamera', 'bomba', 'gaz', 'kriz', 'şoför',
    'restoran', 'menü', 'avukat', 'polis', 'şef', 'stadyum', 'müzik', 'piyano',
    'gitar', 'opera', 'bale', 'banka', 'televizyon', 'telefon', 'organize'
  ]);
  if (!commonLoanwords.has(word) && primaryTr === word) {
    return false;
  }

  // 2. Check senses if present
  if (Array.isArray(card.senses) && card.senses.length > 0) {
    for (const sense of card.senses) {
      if (!Array.isArray(sense.turkishMeanings) || sense.turkishMeanings.length === 0) return false;
      for (const m of sense.turkishMeanings) {
        const ml = (m || '').toLowerCase();
        if (ml.includes('kelimesi') || ml.includes('otomatik anlam') || ml.includes('(anlam)')) return false;
      }
    }
  }

  // 3. Check example sentences
  const allExamples = [
    ...(Array.isArray(card.examples) ? card.examples : []),
    ...(Array.isArray(card.senses) ? card.senses.flatMap((s: any) => s.examples || []) : [])
  ];

  if (allExamples.length === 0) return false;

  // Çekirdek sözlüğü bozan şablonlar.
  //
  // Oxford 3000 verisindeki 9.678 örnek cümlenin 8.515'i (%88) aşağıdaki
  // yirmi bir kalıptan üretilmişti. Kelime sözcük türüne bakılmaksızın kalıbın
  // içine yerleştirildiği için dilbilgisi dışı cümleler çıkıyordu
  // ("I want to ago today because it is very important"). Cümleler veriden
  // çıkarıldı; bu liste yapay zekânın aynı kalıpları üretip veriye geri
  // sokmasını engeller. Kelimenin geçtiği yer <W> ile temsil edilir.
  const templateSkeletons = [
    'A thorough understanding of this <W> is required for the exam.',
    'Can you help me <W> this properly?',
    'Experts highlighted the most <W> factors in their recent report.',
    'Have you seen the new <W> in our local neighborhood?',
    'I want to <W> today because it is very important.',
    'Please remember to sign the form <W> leaving the building.',
    'Recent developments in <W> have attracted widespread attention.',
    'Research shows how organizations <W> during challenging times.',
    'She decided to <W> after talking with her family.',
    'She gave a <W> answer that helped everyone understand.',
    'The committee analyzed the impact of the <W> on future growth.',
    'The manager instructed the team to <W> the process carefully.',
    'The path leads <W> the quiet village and into the hills.',
    'The situation requires a <W> approach from both sides.',
    'The teacher asked a question about the <W> in class.',
    'The weather today felt unusually <W> and pleasant.',
    'They observed a <W> difference in performance across groups.',
    'They were able to <W> the issue before it caused problems.',
    'This is a very <W> example for beginners to study.',
    'We need more information about this <W> before making a decision.',
    'We stayed inside <W> the storm passed over the valley.',
  ];

  const matchesTemplate = (sentence: string): boolean => {
    const normalized = sentence.trim().toLowerCase().replace(/\s+/g, ' ');
    return templateSkeletons.some(skeleton => {
      const [head, tail] = skeleton.toLowerCase().split('<w>');
      if (tail === undefined) return normalized === head.trim();
      const headPart = head.trim();
      const tailPart = tail.trim();
      const headOk = headPart.length === 0 || normalized.startsWith(headPart);
      const tailOk = tailPart.length === 0 || normalized.endsWith(tailPart);
      return headOk && tailOk;
    });
  };

  const badExPatterns = [
    'i learned',
    'learning the word',
    'learning this word',
    'can you make a sentence with',
    'can you explain the meaning of',
    'can you explain the usage of',
    'is very useful',
    'is very beneficial',
    'is commonly used in',
    'is important for communication',
    'bu örnek cümledir',
    'kelimesini öğrenmek çok faydalıdır'
  ];

  const escapeForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (const ex of allExamples) {
    const en = (ex.en || '').toLowerCase();
    const tr = (ex.tr || '').toLowerCase();
    for (const pat of badExPatterns) {
      if (en.includes(pat) || tr.includes(pat)) {
        return false;
      }
    }
    if (matchesTemplate(ex.en || '')) {
      return false;
    }
    /*
     * Örnek cümle hedef kelimeyi gerçekten içermeli; içermiyorsa örnek
     * değildir. ÇEKİMLİ BİÇİMLER DE SAYILIR: "run" için "She ran a marathon"
     * geçerli bir örnektir. Düz alt dize araması düzensiz fiillerin tamamını
     * reddediyordu (bkz. `inflections.ts`).
     */
    if (word && !cumledeGeciyorMu(ex.en || '', word)) {
      return false;
    }
  }

  return true;
}
