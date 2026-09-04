import React from 'react';

/**
 * Kelime kartının üst şeridindeki desen.
 *
 * NEDEN DESEN, NEDEN FOTOĞRAF DEĞİL. Uygulamada on bine yakın kelime var;
 * her kelimeye ayrı bir görsel ne üretilebilir ne de pakete sığar. Altı
 * yeniden kullanılabilir motif, kartlara tema kimliğini kelime başına bir
 * bayt bile veri eklemeden taşıyor.
 *
 * NEDEN TEKRARLAYAN BANT DEĞİL. İlk iki denemede motif kartın üstünde
 * yatay olarak tekrarlanıyordu. Ekranda ölçtüm: tekrarlanan simgeler bir
 * yıldız dizisi gibi okunuyor ve kartın en önemli parçası olan İngilizce
 * kelimeden daha çok dikkat çekiyordu — üstelik şeridi inceltmek ve
 * soluklaştırmak bunu düzeltmedi, yalnızca soluk bir yıldız dizisi oldu.
 *
 * Şimdiki biçim: seviye renginde iki piksellik ince bir çizgi ve SOLDA TEK
 * BİR motif. Kart hem temaya ait görünüyor hem de göz doğrudan kelimeye
 * gidiyor. Desen hiçbir metnin arkasına girmiyor.
 *
 * NEDEN SEVİYEYE GÖRE. Motif rastgele atansaydı aynı kelime her açılışta
 * başka görünürdü. CEFR seviyesi kararlı bir ölçüt: A1 buz, C1 kor. Kullanıcı
 * bir süre sonra şeride bakarak seviyeyi tanıyor, rozeti okumadan.
 */

export type MotifAdi =
  | 'buz'
  | 'ejderha'
  | 'kuzgun'
  | 'harita'
  | 'demir'
  | 'kor';

/** CEFR seviyesi → motif. Bilinmeyen seviye eski haritaya düşer. */
export function motifSec(level?: string | null): MotifAdi {
  switch (level) {
    case 'A1':
      return 'buz';
    case 'A2':
      return 'kuzgun';
    case 'B1':
      return 'harita';
    case 'B2':
      return 'demir';
    case 'C1':
      return 'kor';
    default:
      return 'ejderha';
  }
}

/** Her motifin kendi çizgi rengi; kart zemininden ayrılsın ama bağırmasın. */
const RENK: Record<MotifAdi, string> = {
  buz: 'var(--cefr-a2)',
  ejderha: 'var(--favorite)',
  kuzgun: 'var(--primary)',
  harita: 'var(--gold)',
  demir: 'var(--text-secondary)',
  kor: 'var(--learning)'
};

/** Motifin tek bir yatay diliminin çizimi; `pattern` ile tekrarlanır. */
function desen(ad: MotifAdi): React.ReactNode {
  switch (ad) {
    // Buz kristali: altı kollu yıldızlar.
    case 'buz':
      return (
        <g strokeWidth="1.1" strokeLinecap="round">
          <path d="M11 3v16M4 7l14 8M18 7L4 15" />
          <path d="M11 6l-2.5-2M11 6l2.5-2M11 16l-2.5 2M11 16l2.5 2" strokeWidth="0.9" />
        </g>
      );
    // Ejderha pulu: üst üste binen yarım daireler.
    case 'ejderha':
      return (
        <g strokeWidth="1.1" fill="none">
          <path d="M0 16a8 8 0 0 1 16 0M8 8a8 8 0 0 1 16 0" />
          <path d="M-8 8a8 8 0 0 1 16 0" />
        </g>
      );
    // Kuzgun tüyü: orta damar ve iki yana açılan lifler.
    case 'kuzgun':
      return (
        <g strokeWidth="1" strokeLinecap="round">
          <path d="M11 2c2 6 2 12 0 18" strokeWidth="1.3" />
          <path d="M11 5l-4 2M11 8l-5 2.5M11 11l-4 2M11 14l-3 1.5" />
          <path d="M11 5l4 2M11 8l5 2.5M11 11l4 2M11 14l3 1.5" />
        </g>
      );
    // Eski harita: eş yükselti eğrileri.
    case 'harita':
      return (
        <g strokeWidth="1" fill="none">
          <path d="M-2 6c6-4 12 4 18 0s12 4 18 0" />
          <path d="M-2 12c6-4 12 4 18 0s12 4 18 0" />
          <path d="M-2 18c6-4 12 4 18 0s12 4 18 0" opacity="0.7" />
        </g>
      );
    // Dövme demir: perçinli çubuk ve köşe kıvrımları.
    case 'demir':
      return (
        <g strokeWidth="1.2" fill="none">
          <path d="M0 11h22" />
          <path d="M6 11a2.5 2.5 0 1 1 5 0 2.5 2.5 0 1 1-5 0" strokeWidth="1" />
          <path d="M2 11c0-4 3-6 6-6M20 11c0 4-3 6-6 6" strokeWidth="0.9" opacity="0.8" />
        </g>
      );
    // Kor ve kıvılcım: yükselen noktalar.
    case 'kor':
      return (
        <g strokeWidth="1" strokeLinecap="round">
          <path d="M5 18v-3M11 18v-5M17 18v-3" />
          <circle cx="5" cy="10" r="1.2" />
          <circle cx="11" cy="6" r="1.5" />
          <circle cx="17" cy="9" r="1.1" />
          <circle cx="8" cy="3" r="0.8" opacity="0.7" />
          <circle cx="15" cy="2.5" r="0.8" opacity="0.7" />
        </g>
      );
  }
}

interface Props {
  /** Kartın CEFR seviyesi; motifi bu belirler. */
  level?: string | null;
  className?: string;
}

export const KartMotifi: React.FC<Props> = ({ level, className = '' }) => {
  const ad = motifSec(level);

  return (
    <div
      className={`flex items-center gap-2 h-[14px] w-full ${className}`}
      aria-hidden="true"
    >
      {/* Tek motif: 14 piksel, seviyenin renginde, solda. */}
      <svg width="14" height="14" viewBox="0 0 22 22" className="shrink-0 ml-4">
        <g stroke={RENK[ad]} fill="none" opacity="0.75" strokeWidth="1.6">
          {desen(ad)}
        </g>
      </svg>
      {/* Kalan genişlik boyunca sönümlenen ince çizgi. */}
      <span
        className="h-[2px] flex-1 rounded-full mr-4"
        style={{
          background: `linear-gradient(to right, ${RENK[ad]}, transparent)`,
          opacity: 0.55
        }}
      />
    </div>
  );
};
