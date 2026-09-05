import kargaKaynak from '../../assets/themes/realms/figures/raven-study.webp';
import kurtKaynak from '../../assets/themes/realms/figures/wolf-results.webp';

/**
 * Anlora Realms dekoratif figürü: karga ve kurt.
 *
 * İKİ FİGÜR, İKİ YER. Karga yalnızca çalışma oturumunun başlangıç ekranında,
 * kurt yalnızca sınav bittikten sonraki sonuç kartında görünüyor. Her kartta
 * ya da her soruda tekrar etmiyorlar; ekranda tek bir kez çıkıyorlar.
 *
 * TAMAMEN DEKORATİF. `aria-hidden` ve boş `alt`: ekran okuyucu figürü hiç
 * duymuyor, çünkü yanındaki başlık zaten aynı şeyi söylüyor.
 *
 * BOYUT KAYNAKTAN GELİYOR. Paketin verdiği PNG'ler 1219x1290 ve 1225x1284;
 * her ekranda 1,4 MB ve 2,3 MB indirmek gereksiz. Saydam kenarları kırpılıp
 * kullanıldıkları en büyük ölçünün üç katına küçültülmüş WebP türevleri
 * üretildi (karga 175x192 / 13 KB, kurt 244x288 / 30 KB). Orijinaller
 * yeniden renklendirilmedi, kırpma yalnızca boş saydam kenarları aldı.
 */

const KAYNAK = {
  karga: kargaKaynak,
  kurt: kurtKaynak
} as const;

interface Props {
  figur: keyof typeof KAYNAK;
  /** Görünen yükseklik (piksel). Karga 48–64, kurt 72–96. */
  yukseklik: number;
  className?: string;
}

export function RealmsFigure({ figur, yukseklik, className = '' }: Props) {
  return (
    <img
      src={KAYNAK[figur]}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`block w-auto select-none pointer-events-none ${className}`}
      style={{ height: yukseklik }}
    />
  );
}
