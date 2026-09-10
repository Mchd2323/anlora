import { useCallback, useEffect, useRef, useState } from 'react';
import { WordCard } from '../types';
import { apiUrl, yoklamayiTazele } from '../config/api';
import {
  TopluKuyruk,
  ilkiniDusur,
  kuyrugaAl,
  kuyruguOku
} from '../services/topluKuyruk';

/**
 * Anlora – Toplu eklemeyi arka planda yürüten koşucu.
 *
 * Uygulamanın kökünde bir kez çağrılır; toplu ekleme penceresine bağlı
 * değildir. Pencere kapansa, kullanıcı başka sekmeye geçse, hatta uygulama
 * kapanıp yeniden açılsa bile kuyruk diskte durduğu için kaldığı yerden
 * devam eder.
 *
 * TEK KOŞUCU. Modül düzeyinde bir kilit var: React'in iki kez çalıştırdığı
 * effect'ler (StrictMode) ya da art arda gelen render'lar ikinci bir döngü
 * başlatırsa aynı kelime iki kez üretilir, hem kota harcanır hem çift kart
 * çıkardı.
 */

/** İstekler arasındaki nefes payı. */
const ARA_MS = 250;

/** Bir kelime için en fazla kaç deneme yapılır. */
const DENEME_SAYISI = 3;

/** Denemeler arasındaki bekleme; son deneme için beklenmez. */
const DENEME_BEKLEME_MS = [1_000, 4_000];

/** Kuyruk geçici bir arıza yüzünden duraklarsa ne kadar sonra tekrar dener. */
const DURAKLAMA_MS = 30_000;

/**
 * Tek bir üretim isteğinin zaman aşımı.
 *
 * Yapay zekâ kart üretimi kelime başına sekiz saniyeyi bulabiliyor, bu yüzden
 * geniş tutuldu; amaç yavaş yanıtı kesmek değil, yanıtsız kalan bir isteğin
 * kuyruğu süresiz kilitlemesini önlemek.
 */
const URETIM_ZAMAN_ASIMI_MS = 45_000;

export interface TopluIlerleme {
  /** Kuyruk boşsa null. */
  kuyruk: TopluKuyruk | null;
  /** Şu an üretilen kelime; arayüz bunu gösterebilir. */
  suAnki: string | null;
  /** Sunucuya ulaşılamadığı için beklemede mi? */
  duraklatildi: boolean;
}

interface Secenekler {
  /** Üretilen kartı sete ekler. */
  onKartEkle: (card: WordCard, collectionId: string) => void;
  /** Kuyruk tamamen bitince bir kez çağrılır. */
  onBitti?: (eklenen: number) => void;
}

export function useTopluKuyruk({ onKartEkle, onBitti }: Secenekler): {
  ilerleme: TopluIlerleme;
  kuyrugaEkle: (setId: string, setAdi: string, kelimeler: string[]) => void;
} {
  const [kuyruk, setKuyruk] = useState<TopluKuyruk | null>(() => kuyruguOku());
  const [suAnki, setSuAnki] = useState<string | null>(null);
  const [duraklatildi, setDuraklatildi] = useState(false);

  const calisiyorRef = useRef(false);
  const eklenenRef = useRef(0);
  const zamanlayiciRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onKartEkleRef = useRef(onKartEkle);
  onKartEkleRef.current = onKartEkle;
  const onBittiRef = useRef(onBitti);
  onBittiRef.current = onBitti;

  const dongu = useCallback(async () => {
    if (calisiyorRef.current) return;
    calisiyorRef.current = true;

    if (zamanlayiciRef.current) {
      clearTimeout(zamanlayiciRef.current);
      zamanlayiciRef.current = null;
    }

    try {
      let mevcut = kuyruguOku();
      while (mevcut && mevcut.ogeler.length) {
        const oge = mevcut.ogeler[0];
        setSuAnki(oge.kelime);

        const sonuc = await kartUret(oge.kelime);

        /*
         * GEÇİCİ ARIZADA KELİME HARCANMIYOR.
         *
         * Ağ kesintisi, soğuk başlayan sunucu ya da 5xx yüzünden kelimeyi boş
         * kartla "eklendi" saymak, listenin tamamını saniyeler içinde boş
         * kartlara çeviriyordu: kullanıcı doksan sekiz kelimeyi eklemiş ama
         * hiçbirinin anlamı yok. Öğe kuyrukta kalıyor, koşucu duruyor ve bir
         * süre sonra kendiliğinden yeniden deniyor.
         */
        if (sonuc.tur === 'gecici') {
          setDuraklatildi(true);
          yoklamayiTazele();
          zamanlayiciRef.current = setTimeout(() => {
            zamanlayiciRef.current = null;
            void dongu();
          }, DURAKLAMA_MS);
          return;
        }

        setDuraklatildi(false);
        onKartEkleRef.current(sonuc.kart, oge.setId);
        eklenenRef.current++;

        /*
         * Düşürme ÜRETİMDEN SONRA: uygulama tam o anda kapanırsa kelime
         * kuyrukta kalır ve yeniden denenir.
         *
         * Sonuç da kaydediliyor: anlamı boş kalan kart "eklendi" diye
         * gösterilirse kullanıcı kartı açıp boş bulduğunda bunu hata sanar.
         * Boş kalanlar listede ayrı görünüyor.
         */
        mevcut = ilkiniDusur(sonuc.tur === 'kart' ? 'eklendi' : 'bos');
        setKuyruk(mevcut);

        if (mevcut) await new Promise(r => setTimeout(r, ARA_MS));
      }

      setSuAnki(null);
      setDuraklatildi(false);
      if (eklenenRef.current > 0) {
        onBittiRef.current?.(eklenenRef.current);
        eklenenRef.current = 0;
      }
    } finally {
      calisiyorRef.current = false;
    }
  }, []);

  // Açılışta bekleyen kuyruk varsa devam edilir.
  useEffect(() => {
    if (kuyruguOku()) void dongu();
  }, [dongu]);

  /*
   * Uygulama öne döndüğünde koşucu yeniden dürtülüyor. Android arka planda
   * WebView'i askıya alabiliyor; askıya alınan bir `await` geri döndüğünde
   * döngü kendiliğinden sürer ama tamamen öldürülmüşse sürmez. Bu dinleyici
   * ikinci durumu kurtarıyor; kilit sayesinde birinci durumda ikinci bir
   * döngü başlamıyor. Duraklamış kuyruk da burada hemen uyanıyor:
   * kullanıcı telefonu cebinden çıkarana kadar ağ geri gelmiş olabilir.
   */
  useEffect(() => {
    const geriDonuldu = () => {
      if (document.visibilityState === 'visible' && kuyruguOku()) void dongu();
    };
    document.addEventListener('visibilitychange', geriDonuldu);
    window.addEventListener('online', geriDonuldu);
    return () => {
      document.removeEventListener('visibilitychange', geriDonuldu);
      window.removeEventListener('online', geriDonuldu);
    };
  }, [dongu]);

  useEffect(
    () => () => {
      if (zamanlayiciRef.current) clearTimeout(zamanlayiciRef.current);
    },
    []
  );

  const kuyrugaEkle = useCallback(
    (setId: string, setAdi: string, kelimeler: string[]) => {
      const yeni = kuyrugaAl(setId, setAdi, kelimeler);
      setKuyruk(yeni);
      void dongu();
    },
    [dongu]
  );

  return { ilerleme: { kuyruk, suAnki, duraklatildi }, kuyrugaEkle };
}

/**
 * Bir üretim denemesinin sonucu.
 *
 * `sunucuYok` ile `gecici` ayrımı bu dosyanın en önemli kararı: birincisinde
 * yeniden denemenin anlamı yok (sunucusuz pakette yapay zekâ hiç yok),
 * ikincisinde ise denememenin bedeli kullanıcının listesinin boşalması.
 */
type Deneme =
  | { tur: 'veri'; veri: Record<string, unknown> }
  | { tur: 'sunucuYok' }
  | { tur: 'gecici' };

export type UretimSonucu = { tur: 'kart' | 'bos'; kart: WordCard } | { tur: 'gecici' };

function bosKart(kelime: string): WordCard {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    word: kelime,
    partOfSpeech: '',
    turkishMeaning: '',
    examples: [],
    isCustom: true,
    dateAdded: new Date().toISOString().slice(0, 10)
  };
}

/**
 * Yanıtı sınıflandırır.
 *
 * NEDEN BURADA YETENEK YOKLAMASI YOK. Eskiden `getApiCapabilities()`
 * sorulup `ai` kapalıysa boş karta düşülüyordu. Yoklamanın üç saniyelik
 * zaman aşımı var ve başarısız sonucu otuz saniye önbellekleniyor; soğuk
 * başlayan bir Cloudflare kopyası bunu aşınca kuyruğun TAMAMI tek bir
 * başarısız yoklama yüzünden saniyeler içinde boş kartlara dönüşüyordu --
 * üstelik yapay zekâya tek bir istek bile gitmeden. Tekli ekleme yolu
 * yoklama yapmadan doğrudan istek attığı için çalışmaya devam ediyordu;
 * kullanıcının gördüğü fark tam olarak buydu. Artık iki yol da aynı: önce
 * istek atılır, karar yanıta göre verilir.
 */
async function birDeneme(kelime: string): Promise<Deneme> {
  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), URETIM_ZAMAN_ASIMI_MS);
    try {
      res = await fetch(apiUrl('/api/ai/generate-word'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: kelime }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Ağ hatası ya da zaman aşımı: geçici sayılır.
    return { tur: 'gecici' };
  }

  // 5xx sunucunun kendi arızası, 429 kota, 408 zaman aşımı: hepsi geçebilir.
  if (res.status >= 500 || res.status === 429 || res.status === 408) return { tur: 'gecici' };
  if (!res.ok) return { tur: 'sunucuYok' };

  /*
   * Sunucu yoksa statik barındırma ya da Capacitor kendi index.html'ini 200
   * ile döndürür; JSON denetimi bu ikisini ayırır.
   */
  const tur = res.headers.get('content-type') || '';
  if (!tur.includes('application/json')) return { tur: 'sunucuYok' };

  try {
    const veri = await res.json();
    if (!veri || typeof veri !== 'object') return { tur: 'sunucuYok' };
    return { tur: 'veri', veri: veri as Record<string, unknown> };
  } catch {
    return { tur: 'sunucuYok' };
  }
}

/**
 * Tek bir kelime için kart üretir.
 *
 * HİÇBİR DURUMDA HATA FIRLATMAZ: kuyruk her koşulda ya ilerlemeli ya da
 * açıkça duraklamalı. Yapay zekâ kelimeyi tanımazsa ya da ortada sunucu
 * yoksa kelime ELLE DOLDURULACAK boş kart olarak ekleniyor -- kelimeyi
 * sessizce düşürmek kullanıcının listesini eksiltir, uydurma bir anlam
 * yazmak ise yanlış öğretir.
 */
export async function kartUret(kelime: string): Promise<UretimSonucu> {
  const bos = bosKart(kelime);

  for (let deneme = 0; deneme < DENEME_SAYISI; deneme++) {
    const cevap = await birDeneme(kelime);

    if (cevap.tur === 'gecici') {
      const bekleme = DENEME_BEKLEME_MS[deneme];
      if (bekleme !== undefined) await new Promise(r => setTimeout(r, bekleme));
      continue;
    }

    if (cevap.tur === 'sunucuYok') return { tur: 'bos', kart: bos };

    const veri = cevap.veri;
    // "Bu bir İngilizce kelime değil" cevabında ortada kart yok; boş kart
    // eklenir ve kullanıcı düzeltir.
    if (veri.notAWord) return { tur: 'bos', kart: bos };

    const anlam = typeof veri.turkishMeaning === 'string' ? veri.turkishMeaning : '';
    if (!anlam) return { tur: 'bos', kart: bos };

    return {
      tur: 'kart',
      kart: {
        ...bos,
        word: typeof veri.word === 'string' && veri.word ? veri.word : kelime,
        partOfSpeech: typeof veri.partOfSpeech === 'string' ? veri.partOfSpeech : '',
        turkishMeaning: anlam,
        phonetic: typeof veri.phonetic === 'string' ? veri.phonetic : undefined,
        examples: Array.isArray(veri.examples) ? (veri.examples as WordCard['examples']) : [],
        level: (veri.level as WordCard['level']) || undefined,
        isAiGenerated: true
      }
    };
  }

  return { tur: 'gecici' };
}
