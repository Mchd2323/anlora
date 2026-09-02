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
 */

export interface IntroSlide {
  /** Küçük sıra numarası. */
  index: number;
  title: string;
  body: React.ReactNode;
}

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
              <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-light)] space-y-1.5 min-h-[104px]">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-lg bg-[var(--primary)] text-[var(--surface)] text-[11px] font-black flex items-center justify-center shrink-0">
                    {s.index}
                  </span>
                  <span className="text-sm font-bold text-[var(--text-primary)]">{s.title}</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          {slides.map((s, i) => (
            <button
              key={s.index}
              type="button"
              onClick={() => elle(i)}
              aria-label={`${i + 1}. tanıtım: ${s.title}`}
              aria-current={i === aktif ? 'true' : undefined}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                i === aktif
                  ? 'w-5 bg-[var(--primary)]'
                  : 'w-1.5 bg-[var(--border)] hover:bg-[var(--text-muted)]'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
