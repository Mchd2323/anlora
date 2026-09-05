import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Ana sayfadaki tanıtım manşetleri.
 *
 * NEDEN KARUSEL. İki tanıtım bloğu alt alta duruyordu ve ana sayfanın
 * neredeyse bir ekranını kaplıyordu; kullanıcı kendi setlerine ulaşmak için
 * her açılışta okumadığı bir metni kaydırmak zorunda kalıyordu. Aynı içerik
 * artık tek bir alanda sırayla gösteriliyor: metin kısalmadı, kapladığı yer
 * yarıya indi.
 *
 * KENDİLİĞİNDEN GEÇER AMA ISRAR ETMEZ. Kullanıcı bir noktaya dokunduğu anda
 * otomatik geçiş durur ve bir daha başlamaz. Elle seçim yapan biri okumak
 * istediği yerdedir; onu beş saniye sonra başka bir slayta atmak, kontrolü
 * kullanıcıdan geri almak olur.
 *
 * ERİŞİLEBİLİRLİK: noktalar gerçek düğmedir ve hangi slaytta olunduğunu
 * `aria-current` ile bildirir; hareketi azaltılmış cihazlarda otomatik geçiş
 * hiç başlamaz.
 *
 * NOKTALARIN DOKUNMA HEDEFİ GÖRSEL BOYUTUNDAN BAĞIMSIZDIR. Nokta bir süre
 * yalnızca 6×6 pikseldi: ekranda şık duruyordu ama parmak ucuyla basılamıyordu,
 * çoğu deneme ıskalanıyordu. Yazı boyutunu küçülten kullanıcıda (bkz.
 * useTheme kök font ölçeği) 6 pikselin de altına iniyordu. Kaydırma jesti
 * bilen için bir çıkış yolu, ama motor becerisi kısıtlı kullanıcının tek
 * erişilebilir yolu bu düğmeler. Bu yüzden görünen çubuk içteki span'da kaldı,
 * basılabilir kutu ise düğmenin kendisinde en az 24×24 piksel tutuluyor.
 */

export interface IntroSlide {
  /** Küçük sıra numarası. */
  index: number;
  title: string;
  body: React.ReactNode;
  /**
   * Kartın zeminindeki sahne (Anlora Realms görselleri).
   *
   * Görsellerin dördünde de asıl konu SAĞDA, sol taraf ise karanlık. Kart bu
   * kadrajı `object-position: 70% center` ile koruyor ve metnin durduğu sola
   * soldan sağa açılan bir karartma seriyor: yazı kendi kontrastını
   * görselden değil, karartmadan alıyor.
   */
  gorsel?: string;
  /** Ekran okuyucu için sahnenin kısa tarifi. */
  gorselAlt?: string;
  /**
   * İlk karta true. Karusel açılışta bu kartı gösterdiğinden görseli
   * geciktirmenin anlamı yok; diğer üçü kaydırılana kadar beklesin diye
   * tembel yükleniyor.
   */
  oncelikli?: boolean;
}

/*
 * Metnin üzerindeki karartma — master paketinin `.realm-scene::after` değeri.
 *
 * Kendi ölçümlerimle ayarladığım ara değerlerin yerini paketin kesin
 * durakları aldı: solda neredeyse opak, %78'den sonra hızla açılıyor.
 * Paketin şartı, metin kolonundaki HER gerçek pikselde gövde metninin en az
 * 4,5:1 kontrasta sahip olması; bu değerlerle ölçüldü ve sağlanıyor.
 */
const KARARTMA =
  'linear-gradient(90deg, rgba(10,23,36,.98) 0%, rgba(10,23,36,.92) 34%, ' +
  'rgba(10,23,36,.78) 56%, rgba(10,23,36,.26) 78%, rgba(10,23,36,.08) 100%)';

const GECIS_MS = 6000;

export const IntroCarousel: React.FC<{ slides: IntroSlide[] }> = ({ slides }) => {
  const [aktif, setAktif] = useState(0);
  const [otomatik, setOtomatik] = useState(true);
  const kapsayici = useRef<HTMLDivElement>(null);

  const git = useCallback(
    (hedef: number) => {
      const n = slides.length;
      setAktif(((hedef % n) + n) % n);
    },
    [slides.length]
  );

  useEffect(() => {
    if (!otomatik || slides.length < 2) return;

    // Hareketi azaltılmış cihazlarda kendiliğinden kayma rahatsız edicidir.
    const azalt =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (azalt) return;

    const t = window.setInterval(() => setAktif(o => (o + 1) % slides.length), GECIS_MS);
    return () => window.clearInterval(t);
  }, [otomatik, slides.length]);

  /** Elle seçim yapıldı: otomatik geçiş kalıcı olarak durur. */
  const elle = (hedef: number) => {
    setOtomatik(false);
    git(hedef);
  };

  if (slides.length === 0) return null;

  return (
    <div
      ref={kapsayici}
      className="relative"
      /*
       * KARUSELE DOKUNMAK OTOMATİK GEÇİŞİ DURDURUR.
       *
       * Yalnızca noktalara basmak durduruyordu; oysa okumak için manşetin
       * kendisine bakan biri de "burada kalmak istiyorum" diyordur. Cümlenin
       * ortasında slaytın kayması can sıkıcı.
       *
       * Durdurma yalnızca BU alana dokunulunca olur; ekranın başka yerine
       * dokunmak karuseli etkilemez.
       */
      onPointerDown={() => setOtomatik(false)}
      /*
       * Parmakla kaydırma. Noktalara basmak zorunda kalmadan geçebilmek,
       * telefonda beklenen davranış.
       */
      onTouchStart={e => {
        (kapsayici.current as any)._x = e.touches[0].clientX;
      }}
      onTouchEnd={e => {
        const bas = (kapsayici.current as any)?._x;
        if (typeof bas !== 'number') return;
        const fark = e.changedTouches[0].clientX - bas;
        if (Math.abs(fark) > 40) elle(aktif + (fark < 0 ? 1 : -1));
      }}
    >
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${aktif * 100}%)` }}
        >
          {slides.map((s, i) => {
            /*
             * MEVCUT VE KOMŞU SLAYT HAZIR, GERİSİ TEMBEL.
             *
             * Üç slaytın üçü de rayda duruyor (yatay öteleme ile geçiliyor),
             * ama görseli hemen indirmesi gereken yalnızca ekrandaki ve ona
             * komşu olanlar. Sıradaki slayt hazır olmazsa geçiş sırasında
             * boş bir kutu görünürdü; uzaktakini indirmek ise bedava değil,
             * her sahne 1672x941.
             */
            const uzaklik = Math.min(
              Math.abs(i - aktif),
              slides.length - Math.abs(i - aktif)
            );
            const hazirla = s.oncelikli || uzaklik <= 1;
            return (
            <div key={s.index} className="w-full shrink-0 px-0.5">
              {/*
                `h-full` VE YÜKSELTİLMİŞ `min-h` — ÖLÇÜLDÜ.

                Ray, en uzun slaytın yüksekliğini alıyor; kartlar ise içerik
                kadar uzuyordu. Kısa slaytın altında bu yüzden boş ray kalıyordu:
                360x780'de kart 149 piksel, ray 185 — arada 36 piksel hiçbir şey.
                Kullanıcının "görsel ile noktalar arasındaki gereksiz boşluk"
                dediği şey buydu.

                `h-full` o boşluğu görsele veriyor: kart rayı dolduruyor, görsel
                147'den 183 piksele çıkıyor ve ALTTAKİ HİÇBİR ŞEY YERİNDEN
                OYNAMIYOR — çünkü alan zaten oradaydı.

                `min-h` 132'den 146'ya çıktı: 480x1000'de üç slayt da aynı boyda
                olduğu için orada kazanılacak boşluk yoktu, görsel ancak bu
                değerle büyüyor. Aşağı kayma noktaların boşluğundan geri alınıyor
                (bkz. nokta satırındaki `-mb`).
              */}
              <div className="relative rounded-xl border border-[rgba(183,149,82,.85)] overflow-hidden min-h-[146px] h-full flex">
                {s.gorsel && (
                  <>
                    {/*
                      Sahne kartın zemininde. `object-cover` oranı korur —
                      görsel hiçbir ekran genişliğinde esnemez — `70% center`
                      ise kadrajı sağdaki asıl konuda tutar.
                    */}
                    <img
                      src={s.gorsel}
                      alt={s.gorselAlt || ''}
                      loading={hazirla ? 'eager' : 'lazy'}
                      fetchPriority={s.oncelikli ? 'high' : hazirla ? 'auto' : 'low'}
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ objectPosition: '70% center' }}
                    />
                    <div
                      className="absolute inset-0"
                      style={{ background: KARARTMA }}
                      aria-hidden="true"
                    />
                  </>
                )}
                {/*
                  Metin katmanı. Kutu, başlık ve açıklama sırası değişmedi;
                  yalnızca artık karartmanın üzerinde duruyor.

                  GENİŞLİK %62. Master paketin karartma durakları %78'den sonra
                  hızla açılıyor. Metin sütunu %78 iken ölçtüm: ejderha
                  kartında gün batımı bulutu son satırın ucuna denk geliyor ve
                  gövde metninin kontrastı 2,21'e düşüyordu — paketin kendi
                  şartı (§10) metin kolonundaki HER pikselde 4,5 istiyor.
                  Karartmanın değerlerine dokunmak yerine sütun daraltıldı;
                  şimdi en kötü durum 8,61. Sağdaki taraf zaten sahneye ait.
                */}
                <div
                  className={`relative p-4 space-y-1.5 self-center ${
                    s.gorsel ? 'w-[62%]' : 'w-full'
                  }`}
                >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-lg text-[11px] font-black flex items-center justify-center shrink-0 ${
                      s.gorsel
                        ? 'bg-[#E9D7A8] text-[#15283D]'
                        : 'bg-[var(--primary)] text-[var(--on-primary)]'
                    }`}
                  >
                    {s.index}
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      s.gorsel ? 'text-[#FBF7EF]' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {s.title}
                  </span>
                </div>
                <p
                  className={`text-[11px] leading-relaxed ${
                    s.gorsel ? 'text-[#E6DECB]' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {s.body}
                </p>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {slides.length > 1 && (
        // Noktalar arasındaki boşluk artık düğmelerin kendi 24 piksellik
        // hedeflerinden geliyor; ek bir gap hedefleri gereksizce ayırırdı.
        //
        // BOŞLUK KISILDI. Düğmenin basılabilir kutusu 44 piksel kalıyor
        // (dokunma hedefi), ama görünen çubuk o kutunun ortasında duruyor ve
        // altında da üstünde de kullanılmayan pay var. Üstteki pay `mt-2.5`ten
        // `mt-1`e indi, alttaki pay `-mb-1.5` ile geri alındı: toplam 12
        // piksel. Dokunma hedefinin kendisi küçülmedi.
        <div className="flex items-center justify-center mt-1 -mb-1.5">
          {slides.map((s, i) => (
            <button
              key={s.index}
              type="button"
              onClick={() => elle(i)}
              aria-label={`${i + 1}. tanıtım: ${s.title}`}
              aria-current={i === aktif ? 'true' : undefined}
              className="group flex items-center justify-center min-w-[28px] min-h-[44px] cursor-pointer"
            >
              {/* Görünen çubuk: boyutu eskisiyle birebir aynı, yalnızca artık
                  basılabilir kutunun içinde duruyor. */}
              <span
                aria-hidden="true"
                className={`h-1.5 rounded-full transition-all ${
                  i === aktif
                    ? 'w-5 bg-[var(--primary)]'
                    : 'w-1.5 bg-[var(--border)] group-hover:bg-[var(--text-muted)]'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
