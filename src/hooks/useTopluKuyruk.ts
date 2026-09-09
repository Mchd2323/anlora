import { useCallback, useEffect, useRef, useState } from 'react';
import { WordCard } from '../types';
import { apiUrl, getApiCapabilities } from '../config/api';
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

export interface TopluIlerleme {
  /** Kuyruk boşsa null. */
  kuyruk: TopluKuyruk | null;
  /** Şu an üretilen kelime; arayüz bunu gösterebilir. */
  suAnki: string | null;
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

  const calisiyorRef = useRef(false);
  const eklenenRef = useRef(0);
  const onKartEkleRef = useRef(onKartEkle);
  onKartEkleRef.current = onKartEkle;
  const onBittiRef = useRef(onBitti);
  onBittiRef.current = onBitti;

  const dongu = useCallback(async () => {
    if (calisiyorRef.current) return;
    calisiyorRef.current = true;

    try {
      let mevcut = kuyruguOku();
      while (mevcut && mevcut.ogeler.length) {
        const oge = mevcut.ogeler[0];
        setSuAnki(oge.kelime);

        const kart = await kartUret(oge.kelime);
        onKartEkleRef.current(kart, oge.setId);
        eklenenRef.current++;

        /*
         * Düşürme ÜRETİMDEN SONRA: uygulama tam o anda kapanırsa kelime
         * kuyrukta kalır ve yeniden denenir.
         *
         * Sonuç da kaydediliyor: anlamı boş kalan kart "eklendi" diye
         * gösterilirse kullanıcı kartı açıp boş bulduğunda bunu hata sanar.
         * Boş kalanlar listede ayrı görünüyor.
         */
        mevcut = ilkiniDusur(kart.turkishMeaning ? 'eklendi' : 'bos');
        setKuyruk(mevcut);

        if (mevcut) await new Promise(r => setTimeout(r, ARA_MS));
      }

      setSuAnki(null);
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
   * döngü başlamıyor.
   */
  useEffect(() => {
    const geriDonuldu = () => {
      if (document.visibilityState === 'visible' && kuyruguOku()) void dongu();
    };
    document.addEventListener('visibilitychange', geriDonuldu);
    return () => document.removeEventListener('visibilitychange', geriDonuldu);
  }, [dongu]);

  const kuyrugaEkle = useCallback(
    (setId: string, setAdi: string, kelimeler: string[]) => {
      const yeni = kuyrugaAl(setId, setAdi, kelimeler);
      setKuyruk(yeni);
      void dongu();
    },
    [dongu]
  );

  return { ilerleme: { kuyruk, suAnki }, kuyrugaEkle };
}

/**
 * Tek bir kelime için kart üretir.
 *
 * HİÇBİR DURUMDA HATA FIRLATMAZ: kuyruk her koşulda ilerlemeli. Üretim
 * başarısızsa kelime ELLE DOLDURULACAK boş kart olarak ekleniyor -- bu,
 * toplu ekleme penceresindeki eski davranışın aynısı ve gerekçesi de aynı:
 * kelimeyi sessizce düşürmek kullanıcının listesini eksiltir, uydurma bir
 * anlam yazmak ise yanlış öğretir.
 */
async function kartUret(kelime: string): Promise<WordCard> {
  const bos: WordCard = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    word: kelime,
    partOfSpeech: '',
    turkishMeaning: '',
    examples: [],
    isCustom: true,
    dateAdded: new Date().toISOString().slice(0, 10)
  };

  try {
    const yetenekler = await getApiCapabilities();
    if (!yetenekler.ai) return bos;

    const res = await fetch(apiUrl('/api/ai/generate-word'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: kelime })
    });
    if (!res.ok) return bos;

    const veri = await res.json();
    // "Bu bir İngilizce kelime değil" cevabında ortada kart yok; boş kart
    // eklenir ve kullanıcı düzeltir.
    if (!veri || veri.notAWord) return bos;

    return {
      ...bos,
      word: veri.word || kelime,
      partOfSpeech: veri.partOfSpeech || '',
      turkishMeaning: veri.turkishMeaning || '',
      phonetic: veri.phonetic || '',
      examples: Array.isArray(veri.examples) ? veri.examples : [],
      level: veri.level || undefined,
      isAiGenerated: true
    };
  } catch {
    return bos;
  }
}
