/**
 * Kimliksiz kullanım bildirimi.
 *
 * NE TOPLANIR: kelime başına doğru/yanlış sayısı, aranıp bulunamayan
 * kelimeler ve uygulamanın açıldığı bilgisi.
 *
 * NE TOPLANMAZ: kim olduğu, hangi cihaz, hangi oturum. Sunucuya kimlik
 * gönderilmez ve bir tanımlayıcı üretilip saklanmaz. "En çok zorlanılan
 * kelimeler" ve "en çok aranıp bulunamayanlar" için gereken tek şey
 * toplamlardır; kişi bilgisi bu soruların hiçbirine cevap vermiyor.
 *
 * Bildirimler TAMPONLANIR. Her yanlış cevapta ya da her tuş vuruşunda istek
 * atmak hem pili hem ağı boş yere harcar; birikenler aralıklarla tek istekte
 * gönderilir.
 */

import { apiUrl, hasRemoteApi } from '../config/api';

interface WordTally {
  correct: number;
  wrong: number;
}

const wordBuffer = new Map<string, WordTally>();
const missBuffer = new Set<string>();
let openPending = false;
let flushTimer: number | null = null;

/** Gönderim aralığı. Kısa tutmanın bir faydası yok; veri anlık değil. */
const FLUSH_DELAY_MS = 30_000;

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushUsage();
  }, FLUSH_DELAY_MS);
}

/** Uygulamanın açıldığını bir kez bildirir. */
export function reportAppOpened(): void {
  openPending = true;
  scheduleFlush();
}

/** Bir kelimedeki doğru/yanlış sonucunu biriktirir. */
export function reportWordResult(wordId: string, isCorrect: boolean): void {
  if (!wordId) return;
  const tally = wordBuffer.get(wordId) || { correct: 0, wrong: 0 };
  if (isCorrect) tally.correct++;
  else tally.wrong++;
  wordBuffer.set(wordId, tally);
  scheduleFlush();
}

/**
 * Kullanıcının aradığı ama hiçbir sözlükte bulunmayan kelime.
 *
 * Yöneticinin en çok işine yarayan sinyal bu: insanların istediği ama
 * elimizde olmayan kelimeler.
 */
export function reportMissingWord(word: string): void {
  const clean = (word || '').trim().toLowerCase();
  if (clean.length < 2 || clean.length > 40) return;
  missBuffer.add(clean);
  scheduleFlush();
}

/** Biriken her şeyi tek istekte gönderir. Başarısızlık sessizce yutulur. */
export async function flushUsage(): Promise<void> {
  if (!openPending && wordBuffer.size === 0 && missBuffer.size === 0) return;

  /*
   * SUNUCU YOKSA HİÇBİR ŞEY GÖNDERİLMEZ VE TUTULMAZ.
   *
   * Bu tampon kullanıcının aradığı terimleri ve kelime başına doğru/yanlış
   * sayılarını taşıyor. Sunucusuz kurulumda istek zaten başarısız oluyordu
   * ama tamponlar sınırsız büyümeye devam ediyordu. Yoklama sonucu
   * `hasRemoteApi` içinde önbelleklendiği için ek ağ maliyeti yok.
   */
  if (!(await hasRemoteApi())) {
    openPending = false;
    wordBuffer.clear();
    missBuffer.clear();
    return;
  }

  const payload = {
    opened: openPending,
    words: Array.from(wordBuffer.entries()).map(([id, tally]) => ({ id, ...tally })),
    misses: Array.from(missBuffer)
  };

  // Tampon ÖNCE boşaltılır: istek uzun sürerken biriken yeni veri bir
  // sonraki gönderime kalsın, iki kez sayılmasın.
  openPending = false;
  wordBuffer.clear();
  missBuffer.clear();

  try {
    const response = await fetch(apiUrl('/api/stats/report'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    });
    // Sunucu yoksa Capacitor kendi index.html'ini döndürür; sessizce geçilir.
    void response;
  } catch {
    /* çevrimdışıyız; bu veri kritik değil, kaybolabilir */
  }
}

/**
 * Sayfa kapanırken elde kalanı gönderir.
 *
 * `visibilitychange` kullanılır: mobilde `beforeunload` çoğu zaman hiç
 * tetiklenmez, uygulama arka plana alınıp öldürülür.
 */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushUsage();
  });
}
