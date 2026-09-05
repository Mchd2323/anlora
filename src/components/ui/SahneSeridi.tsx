import kitaplik from '../../assets/themes/realms/realms-library.webp';
import kuzgunHarita from '../../assets/themes/realms/realms-raven-map.webp';
import ejderha from '../../assets/themes/realms/realms-dragon.webp';
import buzKalesi from '../../assets/themes/realms/realms-ice-fortress.webp';

/**
 * Realms sahne şeridi: bir kartın tepesinde duran kompakt görsel.
 *
 * DÖRT SAHNE, SABİT DAĞILIM. Her alanın kendi sahnesi var ve o alan nerede
 * geçiyorsa aynı sahne kullanılıyor: setler kütüphane, Oxford buz kalesi,
 * sınav ejderha, günlük plan kuzgun-harita. Sahne böylece bir süs değil, o
 * bölümün işareti oluyor.
 *
 * KART BAŞINA BİR ŞERİT. Aynı sahne aynı ekranda iki kez çıkmasın diye her
 * sayfada yalnızca tek bir üst görsel var.
 *
 * ÖLÇÜLER PAKETTEN. 96 piksel yükseklik, `object-fit: cover` ve
 * `object-position: 70% center`: görsel esnemiyor, ilgi noktası sağda
 * kalıyor. Kartın köşe yuvarlaklığı kapsayıcının `overflow-hidden`
 * sınıfından geliyor.
 *
 * KÖŞE SÜSÜ YOK. Bu şeridi taşıyan kartlar `parsomen-panel` yerine
 * `gorsel-panel` kullanıyor; altın filigran fotoğrafın üstünde süs gibi
 * değil, karışmış bir çizgi gibi okunuyor (ekranda görüldü).
 */

const SAHNELER = {
  kitaplik: {
    kaynak: kitaplik,
    alt: 'Mum ışığında, rafları kitap dolu eski bir kütüphane'
  },
  kuzgunHarita: {
    kaynak: kuzgunHarita,
    alt: 'Mum ışığında eski bir haritanın başında duran kuzgun'
  },
  ejderha: {
    kaynak: ejderha,
    alt: 'Gün batımında bir kalenin üzerinde süzülen ejderha'
  },
  buzKalesi: {
    kaynak: buzKalesi,
    alt: 'Kar altında buzdan kale'
  }
} as const;

export type SahneAdi = keyof typeof SAHNELER;

interface Props {
  sahne: SahneAdi;
  /** Şerit yüksekliği (piksel). Varsayılan 96. */
  yukseklik?: number;
  /**
   * Ekranın ilk görünen alanındaysa `true`: tarayıcı görseli hemen indirir.
   * Diğer bütün şeritler tembel yükleniyor.
   */
  oncelikli?: boolean;
  className?: string;
}

export function SahneSeridi({ sahne, yukseklik = 96, oncelikli = false, className = '' }: Props) {
  const { kaynak, alt } = SAHNELER[sahne];
  return (
    <img
      src={kaynak}
      alt={alt}
      loading={oncelikli ? 'eager' : 'lazy'}
      fetchPriority={oncelikli ? 'high' : 'auto'}
      decoding="async"
      draggable={false}
      className={`w-full object-cover select-none ${className}`}
      style={{ height: yukseklik, objectPosition: '70% center' }}
    />
  );
}
