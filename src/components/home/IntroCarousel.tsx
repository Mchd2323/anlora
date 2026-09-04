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
 * Metnin üzerindeki karartma. Sol uçta neredeyse opak, metin sütunu bittikten
 * SONRA (%78'den itibaren) hızla açılıyor; böylece sahnenin sağdaki asıl
 * konusu görünür kalırken yazı kendi kontrastını görselden değil karartmadan
 * alıyor.
 *
 * NEDEN AÇILMA %78'DE BAŞLIYOR. İlk denemede karartma %45'te .78'e, %85'te
 * .42'ye iniyordu. Ölçtüm: kitaplık ve kuzgun kartlarında sorun yoktu ama
 * ejderha kartında gün batımı bulutu son satırın ucuna denk geliyor ve gövde
 * metninin kontrastı 3,12'ye düşüyordu — eşik 4,5. Kartın arkasındaki gerçek
 * pikselleri okuyarak ayarlandı, göz kararıyla değil.
 */
const KARARTMA =
  'linear-gradient(90deg, rgba(15,25,38,.93) 0%, rgba(15,25,38,.88) 46%, ' +
  'rgba(15,25,38,.78) 72%, rgba(15,25,38,.18) 92%, rgba(15,25,38,.10) 100%)';

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
          {slides.map(s => (
            <div key={s.index} className="w-full shrink-0 px-0.5">
              <div className="relative rounded-xl border border-[var(--border-light)] overflow-hidden min-h-[132px] flex">
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
                      loading={s.oncelikli ? 'eager' : 'lazy'}
                      fetchPriority={s.oncelikli ? 'high' : 'low'}
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
                  yalnızca artık karartmanın üzerinde duruyor. Genişlik sola
                  sınırlı: sağdaki taraf sahneye bırakılıyor, yazı da
                  karartmanın en koyu bölgesinde kalıyor.
                */}
                <div
                  className={`relative p-4 space-y-1.5 self-center ${
                    s.gorsel ? 'w-[78%]' : 'w-full'
                  }`}
                >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-lg text-[11px] font-black flex items-center justify-center shrink-0 ${
                      s.gorsel
                        ? 'bg-[#E9D7A8] text-[#15283D]'
                        : 'bg-[var(--primary)] text-[var(--surface)]'
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
          ))}
        </div>
      </div>

      {slides.length > 1 && (
        // Noktalar arasındaki boşluk artık düğmelerin kendi 24 piksellik
        // hedeflerinden geliyor; ek bir gap hedefleri gereksizce ayırırdı.
        <div className="flex items-center justify-center mt-2.5">
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
