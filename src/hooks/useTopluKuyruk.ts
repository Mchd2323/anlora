import { useCallback, useEffect, useRef, useState } from 'react';
import { WordCard } from '../types';
import { API_BASE, apiUrl, yoklamayiTazele } from '../config/api';
import {
  TopluKuyruk,
  ilkiniDusur,
  kuyrugaAl,
  kuyruguOku,
  kuyrugaTemizle
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
 * Hız sınırına (429) takıldıysa beklenen süre.
 *
 * Sınıra takılan bir sunucuya otuz saniyede bir dönmek sınırı büyütmüyor,
 * aksine bazı sağlayıcılarda ceza süresini uzatıyor. Üstelik kota GÜNLÜK
 * dolmuşsa hiçbir bekleme yetmez; o yüzden burada asıl iş, kullanıcıya ne
 * olduğunu SÖYLEMEK -- sebep arayüzde yazıyor.
 */
const KOTA_BEKLEME_MS = 120_000;

/**
 * Koşucu bu kadar süredir tek adım ilerlemediyse TAKILMIŞ sayılır.
 *
 * NEDEN GEREKLİ. Android uygulamayı arka plana aldığında WebView'i askıya
 * alıyor ve süren `fetch` çağrısı öldürülüyor -- ama sözü ÇÖZÜLMÜYOR.
 * Uygulama öne döndüğünde döngü hâlâ o sözü bekliyor, kilit "çalışıyor"
 * dediği için `visibilitychange` yeni bir tur da başlatamıyor. Sonuç,
 * kullanıcının bildirdiği ekran: "0 hazır · 57 bekliyor", ilk kelimenin
 * yanında sonsuza kadar dönen bir çark. İstek zaman aşımı da kurtarmıyor,
 * çünkü onun sayacı da askıya alınmış durumda.
 *
 * Süre, tek bir isteğin zaman aşımından (45 sn) belirgin şekilde uzun: yavaş
 * ama yaşayan bir istek yarıda kesilmesin.
 */
const TAKILMA_MS = 75_000;

/**
 * Kullanıcıya "takıldı" denmeden önceki süre.
 *
 * Bekçinin eşiğinden (75 sn) kısa: kullanıcı, otomatik kurtarma devreye
 * girmeden önce durumu görsün ve isterse beklemeyi kendisi kessin. Normal bir
 * üretim yaklaşık sekiz saniye sürdüğü için kırk saniye yanlış alarm vermez.
 */
const TAKILDI_UYARI_MS = 40_000;

/**
 * Bekçinin ne sıklıkla yokladığı.
 *
 * Aynı sayaç ekrandaki saniyeyi de besliyor; on beş saniyede bir güncellenen
 * bir "geçen süre", donmuş bir çarktan çok da farklı görünmüyordu. Üç saniye,
 * canlı görünmesi ile gereksiz yeniden çizim arasında duruyor.
 */
const BEKCI_ARALIK_MS = 3_000;

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
  /** Şu anki kelimenin üzerinde ne kadar süredir durulduğu (ms). */
  gecenSure: number;
  /** Koşucu takılmış görünüyor mu? */
  takildi: boolean;
  /**
   * Son başarısızlığın SEBEBİ, kullanıcıya gösterilmek üzere.
   *
   * Tek bir "Bağlantı bekleniyor" cümlesi, birbirinden çok farklı üç durumu
   * aynı şekilde gösteriyordu: ağın gerçekten kopması, sunucunun hata
   * dönmesi ve günlük kotanın dolması. Kullanıcı ağını değiştirip durumun
   * düzelmesini bekliyor, oysa sorun ağda değil. Sebep yazılıyor.
   */
  sonHata: string | null;
  /**
   * Başarısızlığın TÜRÜ.
   *
   * Metni okumak yerine tür taşınıyor: arayüzün "ağını değiştir" mi yoksa
   * "ağınla ilgisi yok" mu diyeceği buna bağlı ve bu ayrım, kullanıcının
   * boşuna mobil veriye geçip geri dönmesini engelleyen tek şey.
   */
  hataTuru: 'ag' | 'kota' | 'sunucu' | null;
  /** İsteklerin gittiği sunucu; boşsa yapay zekâ bu pakette hiç yok. */
  sunucu: string;
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
  /** Kullanıcı "şimdi tekrar dene" dediğinde çağrılır. */
  yenidenDene: () => void;
  /** Bekleyen bütün kelimeleri düşürüp kuyruğu kapatır. */
  iptalEt: () => void;
} {
  const [kuyruk, setKuyruk] = useState<TopluKuyruk | null>(() => kuyruguOku());
  const [suAnki, setSuAnki] = useState<string | null>(null);
  const [duraklatildi, setDuraklatildi] = useState(false);
  /** Ekrana yansıyan "kaç saniyedir bekliyor" değeri. */
  const [gecenSure, setGecenSure] = useState(0);
  /** Son başarısızlığın sebebi; kullanıcıya aynen gösteriliyor. */
  const [sonHata, setSonHata] = useState<string | null>(null);
  const [hataTuru, setHataTuru] = useState<TopluIlerleme['hataTuru']>(null);

  const calisiyorRef = useRef(false);
  const eklenenRef = useRef(0);
  const zamanlayiciRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Kaçıncı tur olduğumuz. Takılan bir tur terk edilirken artıyor; eski tur
   * bir gün uyanırsa numarasının değiştiğini görüp sessizce çekiliyor.
   * Olmasaydı iki döngü aynı kuyruğu işler, kelimeler iki kez üretilirdi.
   */
  const nesilRef = useRef(0);
  /** Son ilerlemenin zamanı; bekçi buna bakıyor. */
  const sonIlerlemeRef = useRef(0);
  /** Süren isteğin iptal kolu; terk edilen tur bunu çekiyor. */
  const iptalRef = useRef<AbortController | null>(null);
  const onKartEkleRef = useRef(onKartEkle);
  onKartEkleRef.current = onKartEkle;
  const onBittiRef = useRef(onBitti);
  onBittiRef.current = onBitti;

  const dongu = useCallback(async (zorla = false) => {
    if (calisiyorRef.current) {
      if (!zorla) return;
      /*
       * TAKILAN TUR TERK EDİLİYOR. Kilidi beklemek işe yaramaz: beklenen söz
       * hiç çözülmeyebilir (askıya alınmış WebView'de öldürülen istek).
       * Numarayı artırmak eski turu geçersiz kılıyor, iptal kolu da varsa
       * süren isteği kapatıyor.
       */
      nesilRef.current++;
      iptalRef.current?.abort();
      calisiyorRef.current = false;
    }
    calisiyorRef.current = true;
    const nesil = nesilRef.current;
    sonIlerlemeRef.current = Date.now();

    if (zamanlayiciRef.current) {
      clearTimeout(zamanlayiciRef.current);
      zamanlayiciRef.current = null;
    }

    try {
      let mevcut = kuyruguOku();
      while (mevcut && mevcut.ogeler.length) {
        const oge = mevcut.ogeler[0];
        setSuAnki(oge.kelime);
        sonIlerlemeRef.current = Date.now();

        const iptal = new AbortController();
        iptalRef.current = iptal;
        const sonuc = await kartUret(oge.kelime, iptal.signal);
        if (nesil !== nesilRef.current) return; // tur terk edilmiş

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
          setSonHata(sonuc.neden);
          setHataTuru(sonuc.hataTuru);
          sonIlerlemeRef.current = Date.now();
          yoklamayiTazele();
          zamanlayiciRef.current = setTimeout(
            () => {
              zamanlayiciRef.current = null;
              void dongu();
            },
            sonuc.hizSiniri ? KOTA_BEKLEME_MS : DURAKLAMA_MS
          );
          return;
        }

        setDuraklatildi(false);
        /*
         * Başarılı üretimde sebep siliniyor, BOŞ KALAN KARTTA silinmiyor:
         * "eklendi ama anlamı yok" durumunun da bir açıklaması olmalı.
         */
        setSonHata(sonuc.tur === 'kart' ? null : sonuc.neden || null);
        setHataTuru(null);
        /*
         * Kart ekleme KORUMA ALTINDA. Buradan çıkan bir hata (silinmiş set,
         * dolu depolama) bütün döngüyü öldürüyor ve kuyruk, ekranda dönen bir
         * çarkla sonsuza kadar asılı kalıyordu. Kelime yine düşürülüyor:
         * aynı hatayı sonsuza kadar tekrar denemek de kilitlenmektir.
         */
        try {
          onKartEkleRef.current(sonuc.kart, oge.setId);
        } catch {
          /* kart eklenemedi; kuyruk yine de ilerlemeli */
        }
        eklenenRef.current++;
        sonIlerlemeRef.current = Date.now();

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
      // Terk edilmiş bir tur kilidi bırakmamalı: yerine geçen tur çalışıyor.
      if (nesil === nesilRef.current) {
        calisiyorRef.current = false;
        iptalRef.current = null;
      }
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
      if (document.visibilityState !== 'visible' || !kuyruguOku()) return;
      /*
       * Öne dönüşte takılmış bir tur varsa ZORLA yenileniyor. Askıya alınmış
       * WebView'de öldürülen istek geri geldiğimizde de çözülmüyor; kilidi
       * kibarca beklemek, kullanıcının gördüğü sonsuz çarkın ta kendisi.
       */
      void dongu(takilmisMi());
    };
    document.addEventListener('visibilitychange', geriDonuldu);
    window.addEventListener('online', geriDonuldu);
    return () => {
      document.removeEventListener('visibilitychange', geriDonuldu);
      window.removeEventListener('online', geriDonuldu);
    };
  }, [dongu]);

  /** Koşucu çalışıyor görünüp ilerlemiyorsa doğru. */
  const takilmisMi = () =>
    calisiyorRef.current && Date.now() - sonIlerlemeRef.current > TAKILMA_MS;

  /*
   * BEKÇİ. Ekran açıkken de bir istek yanıtsız kalabilir; bu sayaç kuyruğu
   * kendiliğinden kurtarıyor. Aynı zamanda "kaç saniyedir bekliyor" değerini
   * besliyor: kullanıcı donmuş bir çarka değil, ilerleyen bir sayaca bakıyor
   * ve bir şeyin ters gittiğini kendisi görebiliyor.
   */
  useEffect(() => {
    const sayac = setInterval(() => {
      const calisan = calisiyorRef.current || zamanlayiciRef.current !== null;
      setGecenSure(calisan && sonIlerlemeRef.current ? Date.now() - sonIlerlemeRef.current : 0);
      if (takilmisMi() && kuyruguOku()) void dongu(true);
    }, BEKCI_ARALIK_MS);
    return () => clearInterval(sayac);
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

  /**
   * "Şimdi tekrar dene": bekleme süresini atlar, takılmış turu terk eder.
   *
   * Kullanıcının elinde bir kol olmalı. Otuz saniyelik bekleme ya da bekçinin
   * yetmiş beş saniyesi, ekrana bakıp bekleyen biri için uzun; üstelik ağın
   * geri geldiğini çoğu zaman uygulamadan önce kullanıcı bilir.
   */
  const yenidenDene = useCallback(() => {
    yoklamayiTazele();
    void dongu(true);
  }, [dongu]);

  /**
   * Kuyruğu tamamen boşaltır.
   *
   * NEDEN GEREKLİ. Kuyruk diske yazıldığı için uygulama güncellemesinden de
   * sağ çıkıyor; kullanıcı, ESKİ sürümde başlattığı ve artık istemediği bir
   * listeyi durduramıyordu. Bekleyen kelimeler kart olarak EKLENMİYOR: zaten
   * istenmedikleri için iptal ediliyorlar. Eklenmiş olanlar sette kalır.
   */
  const iptalEt = useCallback(() => {
    nesilRef.current++; // süren tur terk edilsin
    iptalRef.current?.abort();
    iptalRef.current = null;
    calisiyorRef.current = false;
    if (zamanlayiciRef.current) {
      clearTimeout(zamanlayiciRef.current);
      zamanlayiciRef.current = null;
    }
    kuyrugaTemizle();
    eklenenRef.current = 0;
    setKuyruk(null);
    setSuAnki(null);
    setDuraklatildi(false);
    setSonHata(null);
    setHataTuru(null);
    setGecenSure(0);
  }, []);

  return {
    ilerleme: {
      kuyruk,
      suAnki,
      duraklatildi,
      gecenSure,
      takildi: gecenSure > TAKILDI_UYARI_MS,
      sonHata,
      hataTuru,
      sunucu: API_BASE
    },
    kuyrugaEkle,
    yenidenDene,
    iptalEt
  };
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
  | { tur: 'sunucuYok'; neden: string }
  | { tur: 'gecici'; neden: string; hizSiniri?: boolean; hataTuru: HataTuru };

/** Geçici başarısızlığın kaynağı. */
export type HataTuru = 'ag' | 'kota' | 'sunucu';

export type UretimSonucu =
  | { tur: 'kart' | 'bos'; kart: WordCard; neden?: string }
  | { tur: 'gecici'; neden: string; hizSiniri?: boolean; hataTuru: HataTuru };

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
async function birDeneme(kelime: string, disSinyal?: AbortSignal): Promise<Deneme> {
  if (!API_BASE && typeof location !== 'undefined' && location.protocol === 'https:' &&
      location.hostname === 'localhost') {
    // Capacitor kabuğunda göreli yol uygulamanın kendi paketine gider.
    return { tur: 'sunucuYok', neden: 'Bu pakete sunucu adresi girilmemiş' };
  }

  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), URETIM_ZAMAN_ASIMI_MS);
    // Terk edilen tur isteği de kapatıyor: yoksa öldürülmüş bir turun isteği
    // arka planda dönmeye devam eder ve kota harcar.
    const disIptal = () => controller.abort();
    disSinyal?.addEventListener('abort', disIptal);
    try {
      res = await fetch(apiUrl('/api/ai/generate-word'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: kelime }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
      disSinyal?.removeEventListener('abort', disIptal);
    }
  } catch {
    /*
     * Ağ hatası ile zaman aşımı burada ayrılamıyor (ikisi de AbortError ya da
     * TypeError olarak geliyor), ama kullanıcı için ikisi de aynı anlama
     * geliyor: istek sunucuya varmadı.
     */
    return { tur: 'gecici', hataTuru: 'ag', neden: 'Sunucuya ulaşılamadı (ağ ya da zaman aşımı)' };
  }

  /*
   * HIZ SINIRI AYRI TUTULUYOR. Aynı "geçici hata" kutusuna atmak, kullanıcıya
   * ağını değiştirtiyordu; oysa 429'da ağın hiçbir kusuru yok ve hızlı
   * yeniden denemek durumu kötüleştiriyor.
   */
  if (res.status === 429) {
    return {
      tur: 'gecici',
      hizSiniri: true,
      hataTuru: 'kota',
      neden: `Anlora AI istekleri sınırlıyor (429)${await hataMetni(res)}`
    };
  }
  if (res.status >= 500) {
    return {
      tur: 'gecici',
      hataTuru: 'sunucu',
      neden: `Sunucu hatası (${res.status})${await hataMetni(res)}`
    };
  }
  if (res.status === 408) {
    return { tur: 'gecici', hataTuru: 'sunucu', neden: 'Sunucu zaman aşımı (408)' };
  }
  if (!res.ok) {
    return { tur: 'sunucuYok', neden: `Sunucu isteği reddetti (${res.status})${await hataMetni(res)}` };
  }

  /*
   * Sunucu yoksa statik barındırma ya da Capacitor kendi index.html'ini 200
   * ile döndürür; JSON denetimi bu ikisini ayırır.
   */
  const tur = res.headers.get('content-type') || '';
  if (!tur.includes('application/json')) {
    return { tur: 'sunucuYok', neden: 'Adres yapay zekâ sunucusuna değil, uygulamanın kendisine gidiyor' };
  }

  try {
    const veri = await res.json();
    if (!veri || typeof veri !== 'object') {
      return { tur: 'sunucuYok', neden: 'Sunucudan beklenmeyen yanıt geldi' };
    }
    return { tur: 'veri', veri: veri as Record<string, unknown> };
  } catch {
    return { tur: 'sunucuYok', neden: 'Sunucu yanıtı okunamadı' };
  }
}

/**
 * Hata gövdesinden okunabilir bir parça çıkarır.
 *
 * Sunucunun kendi açıklaması ("quota exceeded", "model overloaded") tanı için
 * kod numarasından çok daha değerli; kısaltılarak ekrana taşınıyor.
 */
async function hataMetni(res: Response): Promise<string> {
  try {
    const metin = (await res.text()).trim();
    if (!metin) return '';
    let ozet = metin;
    try {
      const j = JSON.parse(metin);
      ozet = String(j?.error?.message || j?.error || j?.message || metin);
    } catch {
      /* düz metin */
    }
    ozet = ozet.replace(/\s+/g, ' ').slice(0, 120);
    return ozet ? ` — ${ozet}` : '';
  } catch {
    return '';
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
export async function kartUret(kelime: string, disSinyal?: AbortSignal): Promise<UretimSonucu> {
  const bos = bosKart(kelime);
  let sonNeden = 'Bilinmeyen hata';
  let sonTur: HataTuru = 'ag';

  for (let deneme = 0; deneme < DENEME_SAYISI; deneme++) {
    const cevap = await birDeneme(kelime, disSinyal);

    if (cevap.tur === 'gecici') {
      sonNeden = cevap.neden;
      sonTur = cevap.hataTuru;
      /*
       * HIZ SINIRINDA YENİDEN DENENMİYOR. Saniyeler arayla üç kez daha
       * vurmak sınırı açmıyor; sağlayıcıya göre ceza süresini uzatıyor.
       * Kuyruk duruyor, sebep ekrana yazılıyor ve daha uzun bekleniyor.
       */
      if (cevap.hizSiniri) {
        return { tur: 'gecici', neden: cevap.neden, hizSiniri: true, hataTuru: 'kota' };
      }
      // Tur terk edildiyse yeniden denemenin anlamı yok.
      if (disSinyal?.aborted) {
        return { tur: 'gecici', neden: cevap.neden, hataTuru: cevap.hataTuru };
      }
      const bekleme = DENEME_BEKLEME_MS[deneme];
      if (bekleme !== undefined) await new Promise(r => setTimeout(r, bekleme));
      continue;
    }

    if (cevap.tur === 'sunucuYok') return { tur: 'bos', kart: bos, neden: cevap.neden };

    const veri = cevap.veri;
    // "Bu bir İngilizce kelime değil" cevabında ortada kart yok; boş kart
    // eklenir ve kullanıcı düzeltir.
    if (veri.notAWord) {
      return { tur: 'bos', kart: bos, neden: 'Yapay zekâ kelimeyi tanımadı' };
    }

    const anlam = typeof veri.turkishMeaning === 'string' ? veri.turkishMeaning : '';
    if (!anlam) return { tur: 'bos', kart: bos, neden: 'Yapay zekâ Türkçe anlam vermedi' };

    return {
      tur: 'kart',
      kart: {
        ...bos,
        /*
         * Kelime KÜÇÜK HARFE çevriliyor. Tekli ekleme kutusu bunu yazarken
         * zaten yapıyor; kuyruk yapmayınca "Split Second" ile "split second"
         * iki ayrı kart oluyordu ve tekrar denetimi de ikisini ayrı sayıyordu.
         */
        word: (typeof veri.word === 'string' && veri.word ? veri.word : kelime).toLowerCase(),
        partOfSpeech: typeof veri.partOfSpeech === 'string' ? veri.partOfSpeech : '',
        turkishMeaning: anlam,
        phonetic: typeof veri.phonetic === 'string' ? veri.phonetic : undefined,
        examples: Array.isArray(veri.examples) ? (veri.examples as WordCard['examples']) : [],
        level: (veri.level as WordCard['level']) || undefined,
        isAiGenerated: true
      }
    };
  }

  return { tur: 'gecici', neden: sonNeden, hataTuru: sonTur };
}
